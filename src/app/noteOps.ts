import type { NoteDoc } from "../db/notes";

/**
 * 笔记列表的纯操作。
 *
 * 从 `useNoteWorkspace` 里抽出来的原因：这些规则（谁覆盖谁、删除后选哪篇、
 * 撤销时要不要去重）以前埋在 hook 里，只能靠点界面验证。抽成纯函数就能直接测。
 */

/** 用改过的笔记替换列表里的同 id 项；不存在则原样返回 */
export function replaceNote(notes: NoteDoc[], updated: NoteDoc): NoteDoc[] {
  return notes.map((n) => (n.id === updated.id ? updated : n));
}

/** 撤销删除时写回：已经在列表里就不重复插入 */
export function insertIfMissing(notes: NoteDoc[], note: NoteDoc): NoteDoc[] {
  return notes.some((n) => n.id === note.id) ? notes : [note, ...notes];
}

/** 改字段（日期/标题）并刷新 updatedAt */
export function patchNote(
  note: NoteDoc,
  patch: Partial<Pick<NoteDoc, "date" | "title">>,
  now = Date.now(),
): NoteDoc {
  return { ...note, ...patch, updatedAt: now };
}

/**
 * 删掉一篇之后，当前应该打开哪一篇：
 * - 删的不是当前篇 → 保持当前选择
 * - 删的是当前篇 → 取剩下的第一篇（列表已按新到旧排好）
 * - 删空了 → null（调用方补一篇新的）
 */
export function nextActiveAfterDelete(
  remaining: NoteDoc[],
  deletedId: string,
  activeId: string | null,
): string | null {
  if (activeId !== deletedId) return activeId;
  return remaining.length > 0 ? remaining[0].id : null;
}
