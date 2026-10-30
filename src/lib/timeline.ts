import type { NoteDoc } from "../db/notes";
import { bodyTextOfBlocks, collectMoods } from "./aggregate";
import { moodChar } from "./mood";

export const MONTH_CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
export const MONTH_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const WEEK_CN = ["日", "一", "二", "三", "四", "五", "六"];

export interface DayGroup {
  date: string;
  notes: NoteDoc[];
}

export function sortByDateDesc(notes: NoteDoc[]): NoteDoc[] {
  return [...notes].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt,
  );
}

export function groupByDay(notes: NoteDoc[]): DayGroup[] {
  const map = new Map<string, NoteDoc[]>();
  for (const n of sortByDateDesc(notes)) {
    const list = map.get(n.date);
    if (list) list.push(n);
    else map.set(n.date, [n]);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, notes: items }));
}

export function dayParts(dateStr: string): { day: string; week: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return { day: dateStr, week: "" };
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return { day: String(Number(m[3])), week: `周${WEEK_CN[d.getDay()]}` };
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 长日期（不带星期）：正文日期行、区间用 */
export function dateLong(dateStr: string): string {
  const m = DATE_RE.exec(dateStr);
  if (!m) return dateStr;
  return `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`;
}

/** 短日期：列表、条目 meta、落款用，年月由上下文给出 */
export function dateShort(dateStr: string): string {
  const m = DATE_RE.exec(dateStr);
  return m ? `${m[2]}.${m[3]}` : dateStr;
}

/** 区间：同年同月省略重复部分，例如「2026 年 10 月 13 日 – 20 日」 */
export function dateRange(from: string, to: string): string {
  const a = DATE_RE.exec(from);
  const b = DATE_RE.exec(to);
  if (!a || !b) return from === to ? from : `${from} – ${to}`;
  const am = Number(a[2]);
  const ad = Number(a[3]);
  const bm = Number(b[2]);
  const bd = Number(b[3]);
  if (a[1] === b[1] && am === bm) return `${a[1]} 年 ${am} 月 ${ad} 日 – ${bd} 日`;
  if (a[1] === b[1]) return `${a[1]} 年 ${am} 月 ${ad} 日 – ${bm} 月 ${bd} 日`;
  return `${a[1]} 年 ${am} 月 ${ad} 日 – ${b[1]} 年 ${bm} 月 ${bd} 日`;
}

export function cnDate(dateStr: string): string {
  const m = DATE_RE.exec(dateStr);
  if (!m) return dateStr;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${dateLong(dateStr)} · 星期${WEEK_CN[d.getDay()]}`;
}

export function timeOf(note: NoteDoc): string {
  const d = new Date(note.createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 条目 meta 用：心情 emoji + 主情绪词（「开心 · 松弛」取「开心」）。 */
/** 心情拆成「印章字 + 备注」，列表里字单独上色，备注跟随常规元信息 */
export function moodParts(note: NoteDoc): { char: string; text: string } {
  const mood = collectMoods([note])[0];
  if (!mood) return { char: "", text: "" };
  return {
    char: moodChar(mood.emoji),
    text: mood.text.split("·")[0].trim().slice(0, 6),
  };
}

export function moodOf(note: NoteDoc): string {
  const { char, text } = moodParts(note);
  if (!char && !text) return "";
  return text ? `${char} ${text}` : char;
}

export function bodyChars(note: NoteDoc): number {
  return bodyTextOfBlocks(note.blocks).replace(/\s+/g, "").length;
}

export function bodyText(note: NoteDoc): string {
  return bodyTextOfBlocks(note.blocks).replace(/\s+/g, " ").trim();
}

export function hasBlockType(note: NoteDoc, type: string): boolean {
  let found = false;
  const walk = (blocks: NoteDoc["blocks"]) => {
    for (const b of blocks) {
      if (found) return;
      if (b.type === type) {
        found = true;
        return;
      }
      const children = (b as { children?: NoteDoc["blocks"] }).children;
      if (children?.length) walk(children);
    }
  };
  walk(note.blocks);
  return found;
}

/** 取笔记里最新一天所在的月份；没有笔记时用当月。 */
export function monthPrefixOf(notes: NoteDoc[], now: Date = new Date()): string {
  const latest = sortByDateDesc(notes)[0];
  if (latest) return latest.date.slice(0, 7);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${m}`;
}

export function monthLabel(prefix: string): { year: number; month: number; cn: string; en: string } {
  const year = Number(prefix.slice(0, 4));
  const month = Number(prefix.slice(5, 7));
  return { year, month, cn: `${MONTH_CN[month - 1]}月`, en: `${year} · ${MONTH_EN[month - 1]}` };
}

export function monthSummary(notes: NoteDoc[], prefix: string): { count: number; days: number; chars: number } {
  const inMonth = notes.filter((n) => n.date.startsWith(prefix));
  return {
    count: inMonth.length,
    days: new Set(inMonth.map((n) => n.date)).size,
    chars: inMonth.reduce((sum, n) => sum + bodyChars(n), 0),
  };
}

export function formatChars(chars: number): string {
  if (chars >= 10000) return `${(chars / 10000).toFixed(1)} 万`;
  return chars.toLocaleString("zh-CN");
}
