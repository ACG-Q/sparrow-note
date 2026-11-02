import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../db/notes";
import { currentPlatform, isMobile } from "./platform";

/**
 * 数据存哪 / 能不能换。
 *
 * - 桌面：默认在用户数据目录（debug 构建在 exe 旁边），可以在设置里换成任意目录
 * - 安卓 / iOS：只有应用私有目录，换不了（系统就是这么设计的）
 * - 浏览器：IndexedDB，由浏览器托管
 *
 * 换位置的真实动作在 `moveDataDir()`：先把库一致性快照（`VACUUM INTO`）写进新目录，
 * 再让 Rust 记下配置，最后重启生效。**旧库不删**，随时能改回来。
 */
export type StorageKind = "sqlite" | "indexeddb";

/** 可选的一个存放位置 */
export type DirOption = {
  kind: "private" | "external" | "custom";
  path: string;
  label: string;
  hint: string;
};

export type StorageStatus = {
  kind: StorageKind;
  /** 当前数据库文件（浏览器里是 IndexedDB 名字） */
  path: string;
  /** 当前数据目录 */
  dir: string;
  /** 库文件 + WAL/SHM 的总大小；浏览器读不到，给 0 */
  sizeBytes: number;
  /** 是否没在用默认目录 */
  isCustom: boolean;
  /** 默认目录（「恢复默认」用） */
  defaultDir: string;
  /** 这个平台能不能换位置 */
  canChoose: boolean;
  /** 可选位置：安卓是「私有 / 外部」，桌面是「默认 / 自定义」+ 自己选 */
  options: DirOption[];
};

export type MoveResult =
  | { ok: true; dir: string; movedAside?: string }
  | { ok: false; reason: string; needsConfirm?: false }
  /** 目标位置已有旧库：等用户确认是否覆盖（旧库会被改名留档） */
  | {
      ok: false;
      reason: string;
      needsConfirm: true;
      oldBytes: number;
      oldModified: number | null;
    };

export async function getStorageStatus(): Promise<StorageStatus> {
  if (!isTauri()) {
    return {
      kind: "indexeddb",
      path: "IndexedDB · sparrow-note",
      dir: "浏览器托管",
      sizeBytes: 0,
      isCustom: false,
      defaultDir: "浏览器托管",
      canChoose: false,
      options: [],
    };
  }
  try {
    return await invoke<StorageStatus>("storage_status");
  } catch {
    return {
      kind: "sqlite",
      path: "（读取失败）",
      dir: "（读取失败）",
      sizeBytes: 0,
      isCustom: false,
      defaultDir: "（读取失败）",
      canChoose: false,
      options: [],
    };
  }
}

/** 旧路径下的文案（设置页里当副标题用） */
export function storageKindText(kind: StorageKind): string {
  return kind === "sqlite" ? "SQLite 单文件" : "浏览器存储";
}

/**
 * 换数据存放位置（桌面和安卓都走这里）。
 *
 * 步骤：让后端检查目标目录（能不能写、里面有没有旧库）→ 把当前库快照写过去 →
 * 记下新目录 → 由调用方决定什么时候重启。
 *
 * 目标目录已有旧库时不直接覆盖：先返回 `needsConfirm`，用户确认后带 `force` 再来一次，
 * 旧库会被改名成 `notes.db.bak-<时间戳>` 留着（连 WAL/SHM 一起挪）。
 *
 * 移动端只能传后端列出来的候选目录（应用私有 / 应用外部），后端会把关。
 * 目录检查放在后端做：fs 插件查文件要过 scope，应用外部目录不在作用域里。
 */
export async function moveDataDir(dir: string, force = false): Promise<MoveResult> {
  if (!isTauri()) return { ok: false, reason: "浏览器里换不了数据位置" };
  const trimmed = dir.trim();
  if (!trimmed) return { ok: false, reason: "目录不能为空" };

  try {
    const prep = await invoke<{
      exists: boolean;
      dbPath: string;
      oldBytes: number;
      oldModified: number | null;
      movedAside: string | null;
    }>("prepare_data_dir", { dir: trimmed, force });

    if (prep.exists && !force) {
      return {
        ok: false,
        needsConfirm: true,
        oldBytes: prep.oldBytes,
        oldModified: prep.oldModified,
        reason: "这个位置已经有一份旧数据",
      };
    }

    // 一致性快照：走 SQLite 自己的 VACUUM INTO，比复制文件安全（WAL 里可能还有没合并的数据）
    const { vacuumInto } = await import("../db/sqlite");
    await vacuumInto(prep.dbPath);
    await invoke("set_data_dir", { dir: trimmed });
    return { ok: true, dir: trimmed, movedAside: prep.movedAside ?? undefined };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** 恢复默认位置（旧库不动） */
export async function resetDataDir(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await invoke("reset_data_dir");
    return true;
  } catch {
    return false;
  }
}

/** 重启应用（换完位置后用） */
export async function restartApp(): Promise<void> {
  if (!isTauri()) return;
  await invoke("restart_app");
}

/** 选目录的结果：取消 / 选中（含是否有「所有文件访问」）/ 选不了 */
export type PickResult =
  | { ok: true; path: string; allFiles: boolean }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; reason: string };

/**
 * 挑一个目录。
 * - 桌面：plugin-dialog 的系统目录选择器
 * - 安卓：我们自己写的插件（`ACTION_OPEN_DOCUMENT_TREE`），把 SAF 的树 URI 换算成真实路径
 */
export async function pickDataDir(): Promise<PickResult> {
  if (!isTauri()) return { ok: false, reason: "浏览器里换不了数据位置" };

  if (isMobile(currentPlatform())) {
    try {
      const info = await invoke<{ uri: string; path: string; allFiles: boolean }>(
        "plugin:sparrow-storage|pick_folder",
      );
      if (!info.path) {
        return {
          ok: false,
          reason: "这个位置换算不出文件路径（云盘、下载目录这类不行），换一个「内部存储 / 存储卡」里的文件夹",
        };
      }
      return { ok: true, path: info.path, allFiles: info.allFiles };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel/i.test(msg)) return { ok: false, cancelled: true };
      return { ok: false, reason: msg || "打不开系统文件夹选择器" };
    }
  }

  try {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const picked = await dialog.open({ directory: true, multiple: false, title: "选择数据存放目录" });
    if (typeof picked !== "string") return { ok: false, cancelled: true };
    return { ok: true, path: picked, allFiles: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** 安卓：「所有文件访问」权限拿到了吗（桌面 / iOS 恒为 true） */
export async function hasAllFilesAccess(): Promise<boolean> {
  if (!isTauri()) return false;
  if (!isMobile(currentPlatform())) return true;
  try {
    const info = await invoke<{ allFiles: boolean }>("plugin:sparrow-storage|storage_access");
    return info.allFiles;
  } catch {
    return false;
  }
}

/** 安卓：跳到系统的「所有文件访问」授权页 */
export async function requestAllFilesAccess(): Promise<void> {
  if (!isTauri() || !isMobile(currentPlatform())) return;
  try {
    await invoke("plugin:sparrow-storage|request_storage_access");
  } catch {
    // 系统没有这个页面就算了，界面上会说明后果
  }
}

/** 这个平台能不能用系统目录选择器挑目录（桌面 / 安卓都可以） */
export function canPickAnyDir(): boolean {
  return isTauri();
}
