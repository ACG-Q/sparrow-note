import type { NoteDoc, NotesBackend } from "./notes";

const DB_NAME = "sparrow-note";
const DB_VERSION = 1;
const STORE = "notes";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const idbBackend: NotesBackend = {
  async listNotes(): Promise<NoteDoc[]> {
    const notes = await withStore<NoteDoc[]>("readonly", (s) => s.getAll());
    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async putNote(note: NoteDoc): Promise<void> {
    await withStore("readwrite", (s) => s.put(note));
  },

  async deleteNote(id: string): Promise<void> {
    await withStore("readwrite", (s) => s.delete(id));
  },

  async clearAllNotes(): Promise<void> {
    await withStore("readwrite", (s) => s.clear());
  },
};
