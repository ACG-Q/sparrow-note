import { invoke } from "@tauri-apps/api/core";
import type { NoteDoc, NotesBackend } from "./notes";

interface SqlDb {
  select<T>(query: string, bind?: unknown[]): Promise<T>;
  execute(query: string, bind?: unknown[]): Promise<unknown>;
}

interface NoteRow {
  id: string;
  title: string;
  date: string;
  created_at: number;
  updated_at: number;
  blocks: string;
}

let dbPromise: Promise<SqlDb> | null = null;

function getDb(): Promise<SqlDb> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { default: Database } = await import("@tauri-apps/plugin-sql");
      const url = await invoke<string>("get_sqlite_url");
      return (await Database.load(url)) as SqlDb;
    })();
  }
  return dbPromise;
}

/** 库里有几条记录读坏了（JSON 解析失败），供「设置 → 存储」提示 */
let corruptRows = 0;

export function getCorruptRowCount(): number {
  return corruptRows;
}

/**
 * 数据库行 → 笔记对象。
 *
 * `blocks` 是 JSON 字符串，历史上出现过写坏/被截断的情况；
 * 坏一条就跳过一条并计数，不要让整个列表读不出来。
 */
export function rowToNote(row: NoteRow): NoteDoc | null {
  let blocks: NoteDoc["blocks"];
  try {
    const parsed: unknown = JSON.parse(row.blocks);
    if (!Array.isArray(parsed)) throw new Error("blocks 不是数组");
    blocks = parsed as NoteDoc["blocks"];
  } catch (err) {
    corruptRows += 1;
    console.error("[sparrow] 跳过一条读不出的笔记：", row.id, err);
    return null;
  }
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    blocks,
  };
}

export const sqliteBackend: NotesBackend = {
  async listNotes(): Promise<NoteDoc[]> {
    const db = await getDb();
    const rows = await db.select<NoteRow[]>(
      "SELECT id, title, date, created_at, updated_at, blocks FROM notes ORDER BY updated_at DESC",
    );
    corruptRows = 0;
    const notes: NoteDoc[] = [];
    for (const row of rows) {
      const note = rowToNote(row);
      if (note) notes.push(note);
    }
    return notes;
  },

  async putNote(note: NoteDoc): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO notes (id, title, date, created_at, updated_at, blocks)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         date = excluded.date,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         blocks = excluded.blocks`,
      [
        note.id,
        note.title,
        note.date,
        note.createdAt,
        note.updatedAt,
        JSON.stringify(note.blocks),
      ],
    );
  },

  async deleteNote(id: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM notes WHERE id = $1", [id]);
  },

  async clearAllNotes(): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM notes", []);
  },
};
