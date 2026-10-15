import type { NoteDoc } from "../db/notes";
import { collectMoods } from "./aggregate";

export interface DayCount {
  date: string;
  count: number;
}

export interface SummaryStats {
  today: number;
  week: number;
  total: number;
}

export interface StreakStats {
  current: number;
  longest: number;
}

export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function countByDate(notes: NoteDoc[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const n of notes) {
    map.set(n.date, (map.get(n.date) ?? 0) + 1);
  }
  return map;
}

/** 本周 = 含今日的近 7 天（滚动窗口）。 */
export function summarize(notes: NoteDoc[], now: Date = new Date()): SummaryStats {
  const map = countByDate(notes);
  let week = 0;
  for (let i = 0; i < 7; i++) {
    week += map.get(dateKey(addDays(now, -i))) ?? 0;
  }
  return { today: map.get(dateKey(now)) ?? 0, week, total: notes.length };
}

export function streaks(notes: NoteDoc[], now: Date = new Date()): StreakStats {
  const days = new Set(countByDate(notes).keys());
  let current = 0;
  let cursor = days.has(dateKey(now)) ? now : addDays(now, -1);
  while (days.has(dateKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sorted) {
    const [y, m, d] = key.split("-").map(Number);
    const cur = new Date(y, m - 1, d);
    run = prev !== null && Math.round((cur.getTime() - prev.getTime()) / 86400000) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = cur;
  }
  return { current, longest };
}

/** 返回近 weeks 周（每周 7 天、按列排列的扁平数组，索引 = 列*7 + 行）共 weeks*7 天，最后一天是今天。 */
export function heatmap(notes: NoteDoc[], weeks = 16, now: Date = new Date()): DayCount[] {
  const map = countByDate(notes);
  const total = weeks * 7;
  const start = addDays(now, -(total - 1));
  const out: DayCount[] = [];
  for (let i = 0; i < total; i++) {
    const key = dateKey(addDays(start, i));
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export function last7Days(notes: NoteDoc[], now: Date = new Date()): DayCount[] {
  const map = countByDate(notes);
  const out: DayCount[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = dateKey(addDays(now, -i));
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export function moodCountsThisMonth(
  notes: NoteDoc[],
  now: Date = new Date(),
): { emoji: string; count: number }[] {
  const prefix = dateKey(now).slice(0, 7);
  const map = new Map<string, number>();
  for (const m of collectMoods(notes)) {
    if (!m.noteDate.startsWith(prefix)) continue;
    map.set(m.emoji, (map.get(m.emoji) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);
}
