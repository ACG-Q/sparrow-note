import type { NoteDoc } from "../db/notes";
import type { SummaryKind } from "./settings";
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
  noteDate: string;
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
          noteDate: note.date,
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
  const now = new Date();  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

/** 只取正文类内容（段落、标题、列表、引用、清单项），跳过心情/地点/联系人等结构化块的字段。
    用于列表摘要与字数统计：摘要要读得连贯，不该混进电话和地址。 */
export function bodyTextOfBlocks(blocks: AppBlock[]): string {
  const STRUCTURED = new Set([
    "mood", "location", "contact", "anniversary",
    "account", "bankcard", "bookmark", "voice", "drawing",
  ]);
  const parts: string[] = [];
  walk(blocks, (b) => {
    if (STRUCTURED.has(b.type)) return;
    if (b.type === "checklist") {
      const raw = (b.props as Record<string, unknown>).items;
      if (typeof raw === "string") {
        try {
          const arr: unknown = JSON.parse(raw);
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
      }
      return;
    }
    const text = inlineText(b.content).trim();
    if (text) parts.push(text);
  });
  return parts.join(" ");
}

export function noteMatchesQuery(note: NoteDoc, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (note.title.toLowerCase().includes(q)) return true;
  if (note.date.includes(q)) return true;
  return plainTextOfBlocks(note.blocks as AppBlock[]).toLowerCase().includes(q);
}

export function entriesOnDate<T extends { noteDate: string }>(entries: T[], date: string): T[] {
  if (!date) return entries;
  return entries.filter((e) => e.noteDate === date);
}

/* ---------- 汇总的统一形状 ----------
   汇总页不再为每种块写一套渲染，而是把它们收成同一种条目，
   主文本 / 附注 / 右侧标记三个槽位各块自己填。 */

export type { SummaryKind };

export interface SummaryEntry {
  noteId: string;
  noteTitle: string;
  noteDate: string;
  /** 主文本 */
  primary: string;
  /** 次要信息，等宽小字 */
  secondary?: string;
  /** 右侧标记（天数 / 完成状态等） */
  right?: string;
  /** 心情用的印章字 */
  mark?: string;
  /** 清单的完成/未完成 */
  done?: boolean;
  /** 纪念日剩余天数，负数是过去 */
  days?: number | null;
}

function sortByDateDesc<T extends { noteDate: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => (a.noteDate < b.noteDate ? 1 : a.noteDate > b.noteDate ? -1 : 0));
}

export function collectSummary(notes: NoteDoc[], kind: SummaryKind): SummaryEntry[] {
  const out: SummaryEntry[] = [];
  for (const note of notes) {
    const base = { noteId: note.id, noteTitle: note.title, noteDate: note.date };
    walk(note.blocks as AppBlock[], (b) => {
      const p = b.props as Record<string, string>;
      switch (kind) {
        case "mood":
          if (b.type === "mood") {
            out.push({
              ...base,
              primary: inlineText(b.content).trim() || "（无备注）",
              mark: p.emoji,
            });
          }
          break;
        case "contact":
          if (b.type === "contact" && (p.name || p.phone || p.relation)) {
            out.push({
              ...base,
              primary: p.name || "（无名）",
              secondary: [p.phone, p.company, p.title].filter(Boolean).join(" · "),
              right: p.relation || undefined,
            });
          }
          break;
        case "anniversary":
          if (b.type === "anniversary" && (p.title || p.date)) {
            out.push({
              ...base,
              primary: p.title || "未命名",
              secondary: p.date,
              days: daysUntil(p.date),
            });
          }
          break;
        case "location":
          if (b.type === "location" && (p.name || p.addr)) {
            out.push({
              ...base,
              primary: p.name || "未命名地点",
              secondary: p.addr || undefined,
              right: p.coord ? "有坐标" : undefined,
            });
          }
          break;
        case "checklist": {
          if (b.type !== "checklist") break;
          try {
            const arr: unknown = JSON.parse(p.items || "[]");
            if (!Array.isArray(arr)) break;
            for (const it of arr) {
              const item = it as { t?: unknown; d?: unknown };
              if (typeof item?.t !== "string" || !item.t.trim()) continue;
              out.push({
                ...base,
                primary: item.t,
                done: Boolean(item.d),
                right: item.d ? "已完成" : "待办",
              });
            }
          } catch {
            // 坏的 items 直接忽略
          }
          break;
        }
        case "bookmark":
          if (b.type === "bookmark" && (p.title || p.url)) {
            out.push({ ...base, primary: p.title || p.url, secondary: p.url || undefined });
          }
          break;
        case "account":
          if (b.type === "account" && (p.site || p.user)) {
            out.push({
              ...base,
              primary: p.site || "未命名站点",
              secondary: p.user || undefined,
              right: p.pass ? "有密码" : undefined,
            });
          }
          break;
        case "bankcard":
          if (b.type === "bankcard" && (p.bank || p.no)) {
            const digits = (p.no || "").replace(/\D/g, "");
            out.push({
              ...base,
              primary: p.bank || "未命名银行",
              secondary: p.kind || undefined,
              right: digits ? `末四位 ${digits.slice(-4)}` : undefined,
            });
          }
          break;
      }
    });
  }
  return sortByDateDesc(out);
}
