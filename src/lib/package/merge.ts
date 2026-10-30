/** 导入策略：merge（按更新时间）/ fill（只补缺）/ overwrite。 */
import type { NoteDoc } from "../../db/notes";
import type { ImportMode } from "./types";

// ---------- 合并 ----------

export function mergeNotes(
  local: NoteDoc[],
  incoming: NoteDoc[],
  mode: ImportMode,
): { toWrite: NoteDoc[]; skipped: number } {
  const byId = new Map(local.map((n) => [n.id, n]));
  const toWrite: NoteDoc[] = [];
  let skipped = 0;

  for (const note of incoming) {
    const existing = byId.get(note.id);
    if (!existing) {
      toWrite.push(note);
      continue;
    }
    if (mode === "overwrite") {
      toWrite.push(note);
      continue;
    }
    if (mode === "fill") {
      skipped += 1;
      continue;
    }
    // merge：文件夹里更新才覆盖
    if (note.updatedAt > existing.updatedAt) toWrite.push(note);
    else skipped += 1;
  }
  return { toWrite, skipped };
}

export function bytesToBlob(bytes: Uint8Array, type = "application/zip"): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer as ArrayBuffer], { type });
}

export function suggestFileName(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `麻雀记-备份-${y}${m}${d}.sparrow`;
}
