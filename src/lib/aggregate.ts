import type { NoteDoc } from "../db/notes";
import type { AppBlock } from "../editor/schema";

export interface MoodEntry {
  noteId: string;
  noteTitle: string;
  noteDate: string;
  emoji: string;
  text: string;
}

export interface ContactEntry {
  noteId: string;
  noteTitle: string;
  noteDate: string;
  name: string;
  phone: string;
  relation: string;
}

export interface AnniversaryEntry {
  noteId: string;
  noteTitle: string;
  title: string;
  date: string;
}

function walk(blocks: AppBlock[], fn: (b: AppBlock) => void): void {
  for (const b of blocks) {
    fn(b);
    if (b.children?.length) walk(b.children as AppBlock[], fn);
  }
}

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text: unknown }).text) : ""))
    .join("");
}

export function collectMoods(notes: NoteDoc[]): MoodEntry[] {
  const out: MoodEntry[] = [];
  for (const note of notes) {
    walk(note.blocks as AppBlock[], (b) => {
      if (b.type === "mood") {
        out.push({
          noteId: note.id,
          noteTitle: note.title,
          noteDate: note.date,
          emoji: b.props.emoji,
          text: inlineText(b.content),
        });
      }
    });
  }
  out.sort((a, b) => (a.noteDate < b.noteDate ? 1 : a.noteDate > b.noteDate ? -1 : 0));
  return out;
}

export function collectContacts(notes: NoteDoc[]): ContactEntry[] {
  const out: ContactEntry[] = [];
  for (const note of notes) {
    walk(note.blocks as AppBlock[], (b) => {
      if (b.type === "contact" && (b.props.name || b.props.phone || b.props.relation)) {
        out.push({
          noteId: note.id,
          noteTitle: note.title,
          noteDate: note.date,
          name: b.props.name,
          phone: b.props.phone,
          relation: b.props.relation,
        });
      }
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  return out;
}

export function collectAnniversaries(notes: NoteDoc[]): AnniversaryEntry[] {
  const out: AnniversaryEntry[] = [];
  for (const note of notes) {
    walk(note.blocks as AppBlock[], (b) => {
      if (b.type === "anniversary" && (b.props.title || b.props.date)) {
        out.push({
          noteId: note.id,
          noteTitle: note.title,
          title: b.props.title || "未命名",
          date: b.props.date,
        });
      }
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

export function daysUntil(dateStr: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number(m[1]) < 100) target = new Date(now.getFullYear(), Number(m[2]) - 1, Number(m[3]));
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function plainTextOfBlocks(blocks: AppBlock[]): string {
  const SKIP_KEYS = new Set(["textAlignment", "backgroundColor", "textColor"]);
  const parts: string[] = [];
  walk(blocks, (b) => {
    parts.push(inlineText(b.content));
    for (const [k, v] of Object.entries(b.props)) {
      if (typeof v !== "string" || !v) continue;
      if (SKIP_KEYS.has(k)) continue;
      if (k === "items" && v.startsWith("[")) {
        try {
          const arr: unknown = JSON.parse(v);
          if (Array.isArray(arr)) {
            for (const it of arr) {
              if (it && typeof it === "object" && typeof (it as { t?: unknown }).t === "string") {
                parts.push((it as { t: string }).t);
              }
            }
          }
        } catch {
          // ignore malformed JSON
        }
        continue;
      }
      if (v.length > 200) continue;
      if (v.startsWith("data:") || /^https?:\/\//.test(v)) continue;
      if (v.startsWith("[{") || v.startsWith('{"')) continue;
      parts.push(v);
    }
  });
  return parts.join("\n");
}

export function noteMatchesQuery(note: NoteDoc, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (note.title.toLowerCase().includes(q)) return true;
  if (note.date.includes(q)) return true;
  return plainTextOfBlocks(note.blocks as AppBlock[]).toLowerCase().includes(q);
}
