import type { AppBlock } from "../editor/schema";
import { idbBackend } from "./idb";
import { sqliteBackend } from "./sqlite";

export interface NoteDoc {
  id: string;
  title: string;
  date: string;
  createdAt: number;
  updatedAt: number;
  blocks: AppBlock[];
}

export interface NotesBackend {
  listNotes(): Promise<NoteDoc[]>;
  putNote(note: NoteDoc): Promise<void>;
  deleteNote(id: string): Promise<void>;
  clearAllNotes(): Promise<void>;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function resolveBackend(isTauriEnv: boolean): NotesBackend {
  return isTauriEnv ? sqliteBackend : idbBackend;
}

export async function listNotes(): Promise<NoteDoc[]> {
  return resolveBackend(isTauri()).listNotes();
}

export async function putNote(note: NoteDoc): Promise<void> {
  return resolveBackend(isTauri()).putNote(note);
}

export async function deleteNote(id: string): Promise<void> {
  return resolveBackend(isTauri()).deleteNote(id);
}

export async function clearAllNotes(): Promise<void> {
  return resolveBackend(isTauri()).clearAllNotes();
}
