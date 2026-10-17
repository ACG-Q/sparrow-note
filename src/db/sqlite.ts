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
  blocks_json: string;
}

let dbPromise: Promise<SqlDb> | null = null;

function getDb(): Promise<SqlDb> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { default: Database } = await import("@tauri-apps/plugin-sql");
      return (await Database.load("sqlite:sparrow.db")) as SqlDb;
    })();
  }
  return dbPromise;
}

function rowToNote(row: NoteRow): NoteDoc {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    blocks: JSON.parse(row.blocks_json) as NoteDoc["blocks"],
  };
}

export const sqliteBackend: NotesBackend = {
  async listNotes(): Promise<NoteDoc[]> {
    const db = await getDb();
    const rows = await db.select<NoteRow[]>(
      "SELECT id, title, date, created_at, updated_at, blocks_json FROM notes ORDER BY updated_at DESC",
    );
    return rows.map(rowToNote);
  },

  async putNote(note: NoteDoc): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO notes (id, title, date, created_at, updated_at, blocks_json)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         date = excluded.date,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         blocks_json = excluded.blocks_json`,
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
