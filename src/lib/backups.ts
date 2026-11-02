import type { NoteDoc } from "../db/notes";
import { isTauri } from "../db/notes";
import { buildPackage } from "./sparrowPackage";

/**
 * 本地自动备份：备份包写到应用数据目录的 `backups/` 下，按份数保留。
 *
 * 为什么不用系统「导出」对话框：自动备份不能每次都让人点两下。应用私有目录
 * （Windows `%APPDATA%\com.sparrow.note`、安卓 `/data/user/0/com.sparrow.note`）
 * 一直是可写的，fs 插件的 AppData 作用域就够用，不必再申请存储权限。
 *
 * 浏览器里没有可写的本地目录 → 这一块直接标记为不可用（只能手动导出）。
 */

export const BACKUP_DIR = "backups";
export const BACKUP_PREFIX = "sparrow-";

/** `sparrow-20261031-201500.sparrow` */
export function backupFileName(now: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const stamp =
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${BACKUP_PREFIX}${stamp}.sparrow`;
}

/** 从文件名读回备份时间（读不出来算不认识的旧文件，不参与排序） */
export function parseBackupTime(name: string): number | null {
  const m = /^sparrow-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.sparrow$/.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const t = new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  ).getTime();
  return Number.isFinite(t) ? t : null;
}

export type BackupInterval = "launch" | "daily" | "weekly";

const DAY = 24 * 60 * 60 * 1000;

/**
 * 到点该不该备份。
 * - `launch`：本次启动之后还没备过（`sessionStart` 之后没有记录）
 * - `daily` / `weekly`：距上次够久，或者从来没备过
 */
export function backupDue(
  lastAt: number | null,
  interval: BackupInterval,
  now: number,
  sessionStart: number,
): boolean {
  if (lastAt === null) return true;
  if (interval === "launch") return lastAt < sessionStart;
  const span = interval === "weekly" ? 7 * DAY : DAY;
  return now - lastAt >= span;
}

/** 保留最新的 keep 份，其余删除（返回要删的文件名） */
export function pruneList(names: string[], keep: number): { keep: string[]; drop: string[] } {
  const sorted = [...names]
    .filter((n) => parseBackupTime(n) !== null)
    .sort((a, b) => (parseBackupTime(b) ?? 0) - (parseBackupTime(a) ?? 0));
  const limit = Math.max(1, Math.floor(keep));
  return { keep: sorted.slice(0, limit), drop: sorted.slice(limit) };
}

export type BackupResult =
  | { ok: true; name: string; bytes: number; at: number }
  | { ok: false; reason: string };

export type BackupOverview = {
  /** 浏览器里没有本地目录，整块不可用 */
  available: boolean;
  count: number;
  lastAt: number | null;
  lastBytes: number;
};

/** 备份能不能用：浏览器里不行，其它（桌面 / 安卓）都写应用私有目录 */
export function backupsAvailable(): boolean {
  return isTauri();
}

async function fsApi() {
  return import("@tauri-apps/plugin-fs");
}

/** 列出已有备份（新的在前）；只能解析出时间的才返回 */
export async function listBackups(): Promise<string[]> {
  if (!backupsAvailable()) return [];
  const fs = await fsApi();
  try {
    const entries = await fs.readDir(BACKUP_DIR, { baseDir: fs.BaseDirectory.AppData });
    return entries
      .filter((e) => e.isFile && parseBackupTime(e.name) !== null)
      .map((e) => e.name)
      .sort((a, b) => (parseBackupTime(b) ?? 0) - (parseBackupTime(a) ?? 0));
  } catch {
    // 目录还不存在（第一次用）
    return [];
  }
}

/** 概览：有几份、最近一次是什么时候、多大 */
export async function backupOverview(): Promise<BackupOverview> {
  if (!backupsAvailable()) return { available: false, count: 0, lastAt: null, lastBytes: 0 };
  const names = await listBackups();
  const lastAt = names.length > 0 ? parseBackupTime(names[0]) : null;
  let lastBytes = 0;
  if (names.length > 0) {
    try {
      const fs = await fsApi();
      const info = await fs.stat(`${BACKUP_DIR}/${names[0]}`, { baseDir: fs.BaseDirectory.AppData });
      lastBytes = info.size ?? 0;
    } catch {
      lastBytes = 0;
    }
  }
  return { available: true, count: names.length, lastAt, lastBytes };
}

/** 真写一份备份；保留份数由调用方传入 */
export async function runBackup(
  notes: NoteDoc[],
  opts: { keep: number; now?: Date } = { keep: 5 },
): Promise<BackupResult> {
  if (!backupsAvailable()) return { ok: false, reason: "浏览器里没有可写的本地目录" };
  if (notes.length === 0) return { ok: false, reason: "还没有笔记可以备份" };
  const now = opts.now ?? new Date();
  try {
    const built = await buildPackage(notes, { now });
    const fs = await fsApi();
    await fs.mkdir(BACKUP_DIR, { baseDir: fs.BaseDirectory.AppData, recursive: true });
    const name = backupFileName(now);
    await fs.writeFile(`${BACKUP_DIR}/${name}`, built.bytes, {
      baseDir: fs.BaseDirectory.AppData,
    });
    // 只留最近 keep 份
    const { drop } = pruneList(await listBackups(), opts.keep);
    for (const old of drop) {
      try {
        await fs.remove(`${BACKUP_DIR}/${old}`, { baseDir: fs.BaseDirectory.AppData });
      } catch {
        // 删不掉不影响这次备份成功
      }
    }
    return { ok: true, name, bytes: built.bytes.length, at: now.getTime() };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** 设置页里显示「备份目录」用的绝对路径前缀 */
export async function backupDirPath(): Promise<string | null> {
  if (!backupsAvailable()) return null;
  try {
    const { appDataDir } = await import("@tauri-apps/api/path");
    const root = await appDataDir();
    return root.endsWith("/") || root.endsWith("\\") ? `${root}${BACKUP_DIR}` : `${root}/${BACKUP_DIR}`;
  } catch {
    return null;
  }
}

/** 本次启动的时刻：判断「每次启动备份」用，模块加载即启动 */
const SESSION_START = Date.now();

/**
 * 启动时调用一次：到了设定的频率就自动备份一份。
 * 返回 null 表示这次不需要备份（关着、浏览器里、没有笔记、还没到点）。
 */
export async function maybeAutoBackup(notes: NoteDoc[]): Promise<BackupResult | null> {
  const { getSettings, setSetting } = await import("./settings");
  const settings = getSettings();
  if (!settings.autoBackup || !backupsAvailable() || notes.length === 0) return null;
  if (
    !backupDue(settings.lastBackupAt, settings.backupInterval, Date.now(), SESSION_START)
  ) {
    return null;
  }
  const result = await runBackup(notes, { keep: settings.backupKeep });
  if (result.ok) setSetting("lastBackupAt", result.at);
  return result;
}
