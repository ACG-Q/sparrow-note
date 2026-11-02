// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 换数据位置的前端流程：让后端检查目录 → 写快照 → 记配置 → 重启。
 * 三处边界都钉住：目标目录已有旧库（要二次确认）、快照失败、成功。
 */

const invokeMock = vi.hoisted(() => ({
  fn: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock.fn }));

const vacuumInto = vi.fn(async (_target: string) => {});
vi.mock("../db/sqlite", () => ({
  getCorruptRowCount: () => 0,
  rowToNote: () => null,
  vacuumInto: (target: string) => vacuumInto(target),
}));

const open = vi.fn(async (_opts?: unknown): Promise<string | null> => null);
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: (opts?: unknown) => open(opts) }));

const tauri = { value: true };
vi.mock("../db/notes", () => ({
  isTauri: () => tauri.value,
  listNotes: async () => [],
  putNote: async () => {},
  deleteNote: async () => {},
  clearAllNotes: async () => {},
}));

import {
  getStorageStatus,
  moveDataDir,
  pickDataDir,
  resetDataDir,
  restartApp,
  storageKindText,
} from "./storageInfo";

const invoke = invokeMock.fn;
const calledWith = (cmd: string) => invoke.mock.calls.some((c) => c[0] === cmd);
const EXTERNAL = "/storage/emulated/0/Android/data/com.sparrow.note/files/Documents";

const status = {
  kind: "sqlite",
  path: "/data/user/0/com.sparrow.note/files/notes.db",
  dir: "/data/user/0/com.sparrow.note/files",
  sizeBytes: 2048,
  isCustom: false,
  defaultDir: "/data/user/0/com.sparrow.note/files",
  canChoose: true,
  options: [
    { kind: "private", path: "/data/user/0/com.sparrow.note/files", label: "应用私有目录", hint: "" },
    { kind: "external", path: EXTERNAL, label: "应用外部目录", hint: "" },
  ],
};

function prepResult(over: Partial<{ exists: boolean; movedAside: string | null }> = {}) {
  return {
    exists: over.exists ?? false,
    dbPath: `${EXTERNAL}/notes.db`,
    oldBytes: 20480,
    oldModified: 1700000000000,
    movedAside: over.movedAside ?? null,
  };
}

beforeEach(() => {
  tauri.value = true;
  invoke.mockReset();
  invoke.mockImplementation(async (cmd: unknown) => {
    if (cmd === "prepare_data_dir") return prepResult();
    if (cmd === "storage_status") return status;
    return undefined;
  });
  vacuumInto.mockClear();
  open.mockClear();
});

describe("getStorageStatus", () => {
  it("Tauri 里读后端返回的状态与可选位置", async () => {
    const got = await getStorageStatus();
    expect(calledWith("storage_status")).toBe(true);
    expect(got.sizeBytes).toBe(2048);
    expect(got.options).toHaveLength(2);
    expect(storageKindText(got.kind)).toBe("SQLite 单文件");
  });

  it("浏览器里给出 IndexedDB 兜底，且不能换位置", async () => {
    tauri.value = false;
    const got = await getStorageStatus();
    expect(got.kind).toBe("indexeddb");
    expect(got.canChoose).toBe(false);
    expect(got.options).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("后端报错时不炸，显示读取失败", async () => {
    invoke.mockRejectedValueOnce(new Error("boom"));
    const got = await getStorageStatus();
    expect(got.path).toContain("读取失败");
  });
});

describe("moveDataDir", () => {
  it("先让后端检查目录、写快照，最后才记配置", async () => {
    const result = await moveDataDir(EXTERNAL);
    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith("prepare_data_dir", { dir: EXTERNAL, force: false });
    expect(vacuumInto).toHaveBeenCalledWith(`${EXTERNAL}/notes.db`);
    expect(calledWith("set_data_dir")).toBe(true);
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("prepare_data_dir")).toBeLessThan(order.indexOf("set_data_dir"));
    expect(vacuumInto.mock.invocationCallOrder[0]).toBeLessThan(
      invoke.mock.invocationCallOrder[order.indexOf("set_data_dir")],
    );
  });

  it("目标位置已有旧库时先返回 needsConfirm，不写任何东西", async () => {
    invoke.mockImplementation(async (cmd: unknown) => {
      if (cmd === "prepare_data_dir") return prepResult({ exists: true });
      return undefined;
    });
    const result = await moveDataDir(EXTERNAL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.needsConfirm).toBe(true);
      if (result.needsConfirm) {
        expect(result.oldBytes).toBe(20480);
        expect(result.oldModified).toBe(1700000000000);
      }
    }
    expect(vacuumInto).not.toHaveBeenCalled();
    expect(calledWith("set_data_dir")).toBe(false);
  });

  it("确认后带 force 再来一次，旧库改名留档", async () => {
    invoke.mockImplementation(async (cmd: unknown, args?: unknown) => {
      if (cmd !== "prepare_data_dir") return undefined;
      const force = (args as { force?: boolean }).force;
      return prepResult({ exists: !force, movedAside: force ? "notes.db.bak-1700000000" : null });
    });
    const result = await moveDataDir(EXTERNAL, true);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.movedAside).toBe("notes.db.bak-1700000000");
    expect(invoke).toHaveBeenCalledWith("prepare_data_dir", { dir: EXTERNAL, force: true });
    expect(calledWith("set_data_dir")).toBe(true);
  });

  it("后端拒绝这个目录时如实返回原因", async () => {
    invoke.mockImplementation(async (cmd: unknown) => {
      if (cmd === "prepare_data_dir") throw new Error("这个目录不允许");
      return undefined;
    });
    const result = await moveDataDir("/sdcard/别人的目录");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("不允许");
  });

  it("快照失败时不写配置（不能让应用指向一个空目录）", async () => {
    vacuumInto.mockRejectedValueOnce(new Error("磁盘满了"));
    const result = await moveDataDir(EXTERNAL);
    expect(result.ok).toBe(false);
    expect(calledWith("set_data_dir")).toBe(false);
  });

  it("空目录名直接拒绝", async () => {
    expect((await moveDataDir("   ")).ok).toBe(false);
  });

  it("浏览器里换不了", async () => {
    tauri.value = false;
    expect((await moveDataDir("/x")).ok).toBe(false);
  });
});

describe("恢复默认 / 重启 / 选目录", () => {
  it("resetDataDir 调 reset_data_dir", async () => {
    expect(await resetDataDir()).toBe(true);
    expect(calledWith("reset_data_dir")).toBe(true);
  });

  it("resetDataDir 失败返回 false", async () => {
    invoke.mockRejectedValueOnce(new Error("x"));
    expect(await resetDataDir()).toBe(false);
  });

  it("restartApp 调 restart_app", async () => {
    await restartApp();
    expect(calledWith("restart_app")).toBe(true);
  });
});

describe("pickDataDir", () => {
  it("桌面：用 plugin-dialog 的目录选择器", async () => {
    window.history.replaceState(null, "", "/?platform=windows");
    open.mockResolvedValueOnce("/tmp/新位置");
    expect(await pickDataDir()).toEqual({ ok: true, path: "/tmp/新位置", allFiles: true });
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ directory: true }));
  });

  it("桌面：取消返回 cancelled", async () => {
    window.history.replaceState(null, "", "/?platform=windows");
    open.mockResolvedValueOnce(null);
    expect(await pickDataDir()).toEqual({ ok: false, cancelled: true });
  });

  it("安卓：走自研插件，把树 URI 换算成路径", async () => {
    window.history.replaceState(null, "", "/?platform=android");
    invoke.mockImplementation(async (cmd: unknown) => {
      if (cmd === "plugin:sparrow-storage|pick_folder") {
        return {
          uri: "content://com.android.externalstorage.documents/tree/primary%3A%E9%BA%BB%E9%9B%80%E8%AE%B0",
          path: "/storage/emulated/0/麻雀记",
          allFiles: true,
        };
      }
      return undefined;
    });
    expect(await pickDataDir()).toEqual({
      ok: true,
      path: "/storage/emulated/0/麻雀记",
      allFiles: true,
    });
    // 没有「所有文件访问」时如实带出来，界面据此引导去授权
    invoke.mockImplementation(async () => ({
      uri: "content://x",
      path: "/storage/emulated/0/麻雀记",
      allFiles: false,
    }));
    const noAccess = await pickDataDir();
    expect(noAccess.ok && noAccess.allFiles).toBe(false);
  });

  it("安卓：换算不出路径时说明原因", async () => {
    window.history.replaceState(null, "", "/?platform=android");
    invoke.mockImplementation(async () => ({ uri: "content://云盘", path: "", allFiles: true }));
    const got = await pickDataDir();
    expect(got.ok).toBe(false);
    if (!got.ok && !got.cancelled) expect(got.reason).toContain("换算不出文件路径");
  });

  it("安卓：用户取消 → cancelled", async () => {
    window.history.replaceState(null, "", "/?platform=android");
    invoke.mockImplementation(async () => {
      throw new Error("cancelled");
    });
    expect(await pickDataDir()).toEqual({ ok: false, cancelled: true });
  });
});

