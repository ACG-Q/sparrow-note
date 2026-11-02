// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "./db/notes";

/**
 * 设置页的「数据与存储」：桌面/移动端那一套（能换位置、能立即备份）。
 * 浏览器降级分支在 views.settings.test.tsx 里测。
 */

type BackupResultMock =
  | { ok: true; name: string; bytes: number; at: number }
  | { ok: false; reason: string };

const runBackup = vi.fn<() => Promise<BackupResultMock>>(async () => ({
  ok: true,
  name: "sparrow-20261031-201533.sparrow",
  bytes: 2048,
  at: 1,
}));
const backupOverview = vi.fn(async () => ({
  available: true,
  count: 3,
  lastAt: new Date(2026, 9, 30, 9, 5, 0).getTime(),
  lastBytes: 4096,
}));
vi.mock("./lib/backups", () => ({
  backupsAvailable: () => true,
  backupOverview: () => backupOverview(),
  runBackup: () => runBackup(),
  backupDirPath: async () => "/data/user/0/com.sparrow.note/backups",
}));

const storageStatus = {
  kind: "sqlite" as const,
  path: "/data/user/0/com.sparrow.note/files/notes.db",
  dir: "/data/user/0/com.sparrow.note/files",
  sizeBytes: 204800,
  isCustom: false,
  defaultDir: "/data/user/0/com.sparrow.note/files",
  canChoose: true,
  options: [
    {
      kind: "private" as const,
      path: "/data/user/0/com.sparrow.note/files",
      label: "应用私有目录",
      hint: "系统内部存储，其它应用看不到",
    },
    {
      kind: "external" as const,
      path: "/storage/emulated/0/Android/data/com.sparrow.note/files/Documents",
      label: "应用外部目录",
      hint: "电脑用 USB 能看到",
    },
  ],
};
const moveDataDir = vi.fn(async (dir: string) => ({ ok: true as const, dir }));
vi.mock("./lib/storageInfo", () => ({
  getStorageStatus: async () => storageStatus,
  storageKindText: (kind: "sqlite" | "indexeddb") => (kind === "sqlite" ? "SQLite 单文件" : "浏览器存储"),
  pickDataDir: async () => ({ ok: true, path: "/sdcard/麻雀记", allFiles: true }),
  requestAllFilesAccess: async () => {},
  canPickAnyDir: () => true,
  moveDataDir: (dir: string) => moveDataDir(dir),
  restartApp: async () => {},
}));

const settingsStub = vi.hoisted(() => {
  const state = {
    store: {
      autoBackup: true,
      backupInterval: "daily",
      backupKeep: 5,
      lastBackupAt: null,
      mapProvider: "amap",
    } as Record<string, unknown>,
  };
  const listeners = new Set<() => void>();
  return {
    state,
    emit: () => listeners.forEach((fn) => fn()),
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
});
const setSetting = vi.fn();
vi.mock("./lib/settings", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    // 和真实实现一样：每次改都换一个新对象，useSyncExternalStore 才会重渲染
    useSettings: () => useSyncExternalStore(settingsStub.subscribe, () => settingsStub.state.store),
    setSetting: (k: string, v: unknown) => {
      settingsStub.state.store = { ...settingsStub.state.store, [k]: v };
      setSetting(k, v);
      settingsStub.emit();
    },
  };
});
const store = () => settingsStub.state.store;

vi.mock("./db/notes", () => ({
  putNote: async () => {},
  clearAllNotes: async () => {},
  listNotes: async () => [],
  deleteNote: async () => {},
  isTauri: () => true,
}));
vi.mock("./db/sqlite", () => ({ getCorruptRowCount: () => 0, rowToNote: () => null }));
vi.mock("./lib/mapProviders", () => ({ MAP_PROVIDERS: [] }));

import { SettingsView } from "./SettingsView";

const notes: NoteDoc[] = [
  {
    id: "a",
    title: "秋日骑行",
    date: "2026-10-30",
    createdAt: 1,
    updatedAt: 1,
    blocks: [
      {
        id: "p",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: "沿江骑了十二公里", styles: {} }],
        children: [],
      },
    ] as never,
  },
];

const setup = (over: Partial<Parameters<typeof SettingsView>[0]> = {}) =>
  render(<SettingsView notes={notes} onDataCleared={() => {}} onBack={() => {}} {...over} />);

beforeEach(() => {
  runBackup.mockClear();
  backupOverview.mockClear();
  setSetting.mockClear();
  moveDataDir.mockClear();
  // 换位置要二次确认：这个测试里不是移动端 Tauri，走的是 window.confirm
  vi.stubGlobal("confirm", () => true);
  settingsStub.state.store.autoBackup = true;
  settingsStub.state.store.backupKeep = 5;
});

describe("设置页 · 数据与存储", () => {
  it("显示用量、数据库路径与占用、上次备份时间", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/1 篇笔记/));
    const text = container.textContent || "";
    expect(text).toContain("/data/user/0/com.sparrow.note/files/notes.db");
    expect(text).toMatch(/SQLite 单文件/);
    expect(text).toMatch(/现有 3 份/);
    expect(text).toMatch(/10-30 09:05/);
  });

  it("移动端给出两个真实位置可选，当前那个标成「当前使用中」，并且能自己挑目录", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/应用私有目录/));
    const text = container.textContent || "";
    expect(text).toMatch(/应用外部目录/);
    expect(text).toMatch(/当前使用中/);
    const boxes = [...container.querySelectorAll('button[role="radio"]')];
    expect(boxes).toHaveLength(2);
    expect((boxes[0] as HTMLButtonElement).disabled).toBe(true); // 当前这个不可再点
    // 安卓现在也能用系统文件夹选择器挑任意目录
    expect([...container.querySelectorAll("button")].some((b) => /选择位置/.test(b.textContent || ""))).toBe(true);
  });

  it("点另一个位置会先复制快照再重启", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/应用外部目录/));
    const external = [...container.querySelectorAll('button[role="radio"]')][1] as HTMLButtonElement;
    fireEvent.click(external);
    await waitFor(() => expect(moveDataDir).toHaveBeenCalledWith(
      "/storage/emulated/0/Android/data/com.sparrow.note/files/Documents",
    ));
  });

  it("点「立即备份」会真的跑一次备份，并记下时间", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/立即备份/));
    fireEvent.click([...container.querySelectorAll("button")].find((b) => b.textContent === "立即备份") as HTMLElement);
    await waitFor(() => expect(runBackup).toHaveBeenCalledTimes(1));
    expect(setSetting).toHaveBeenCalledWith("lastBackupAt", 1);
    await waitFor(() => expect(container.textContent).toMatch(/已备份：sparrow-/));
  });

  it("备份失败要说原因，不能假装成功", async () => {
    runBackup.mockResolvedValueOnce({ ok: false, reason: "磁盘满了" });
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/立即备份/));
    fireEvent.click([...container.querySelectorAll("button")].find((b) => b.textContent === "立即备份") as HTMLElement);
    await waitFor(() => expect(container.textContent).toMatch(/备份失败：磁盘满了/));
  });

  it("关掉自动备份后不再显示频率与保留份数", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/自动备份/));
    expect(container.textContent).toMatch(/每次启动/);
    fireEvent.click(
      container.querySelector('button[role="checkbox"][aria-label="自动备份"]') as HTMLElement,
    );
    await waitFor(() => expect(store().autoBackup).toBe(false));
    expect(container.textContent).not.toMatch(/每次启动/);
  });
});
