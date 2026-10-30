import type { NoteDoc } from "../db/notes";

/**
 * 写库的重试与失败登记。
 *
 * 为什么要这块：以前写失败只闪 1.6 秒「保存失败」就没了——用户以为存上了，其实没有。
 * 现在的策略：
 *   1. 先写一次，失败就自动再试一次（多半是瞬时错误：磁盘忙、权限抖动）
 *   2. 两次都失败 → 交给 UI 常驻提示「没存上 · 重试」，并把这次没写进去的笔记留在内存里
 *   3. 用户点重试再走一遍同样的流程
 */

export type SaveOutcome = "ok" | "failed";

/** 写入函数：成功返回，失败抛出 */
export type WriteFn = (note: NoteDoc) => Promise<void>;

/** 失败登记：等用户点重试的那一份 */
export type FailedSave = {
  note: NoteDoc;
  attempts: number;
  reason: string;
};

export type SaveResult =
  | { ok: true; attempts: number }
  | { ok: false; attempts: number; reason: string };

const errText = (err: unknown): string =>
  err instanceof Error ? err.message : String(err ?? "未知错误");

/**
 * 写一次，失败自动重试一次。返回结果而不是抛异常，调用方好处理。
 * 重试间隔由 `delayMs` 控制（默认 300ms，单测里传 0）。
 */
export async function writeWithRetry(
  write: WriteFn,
  note: NoteDoc,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<SaveResult> {
  const attempts = Math.max(1, opts.attempts ?? 2);
  const delayMs = Math.max(0, opts.delayMs ?? 300);
  let lastReason = "";

  for (let i = 1; i <= attempts; i += 1) {
    try {
      await write(note);
      return { ok: true, attempts: i };
    } catch (err) {
      lastReason = errText(err);
      if (i < attempts && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  return { ok: false, attempts, reason: lastReason };
}
