import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const anniversaryConfig = {
  type: "anniversary",
  propSchema: {
    ...defaultProps,
    title: { default: "" },
    date: { default: "" },
    kind: { default: "anniversary", values: ["count", "down", "anniversary"] },
    annual: { default: true },
    /** "on" 时参与每日提醒 */
    remind: { default: "off" },
    /** 提前几天（0 表示当天） */
    remindDays: { default: "0" },
  },
  content: "none",
} as const;

export type AnniversaryProps = ReactCustomBlockRenderProps<typeof anniversaryConfig>;
export type AnniversaryBlockT = AnniversaryProps["block"];
export type AnniversaryEditor = AnniversaryProps["editor"];

export type DayKind = "count" | "down" | "anniversary";

export type DayStats = { num: string; tag?: string; sub?: string };

const DAY_MS = 86400000;

function parseDate(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function dayStats(
  kind: DayKind,
  date: string,
  annual: boolean,
  today = new Date(),
): DayStats | null {
  const d = parseDate(date);
  if (!d) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (kind === "count") {
    const n = diffDays(d, t);
    if (n < 0) return { num: "还未开始", tag: "正计时", sub: date };
    return { num: n === 0 ? "第 1 天" : `第 ${n + 1} 天`, tag: "正计时", sub: `始于 ${date}` };
  }

  if (kind === "down") {
    const n = diffDays(t, d);
    return {
      num: n > 0 ? `还有 ${n} 天` : n === 0 ? "就是今天" : `已过 ${-n} 天`,
      tag: "倒计时",
      sub: date,
    };
  }

  const thisYear = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  const gap = diffDays(t, thisYear);
  let passed = t.getFullYear() - d.getFullYear();
  if (gap < 0) passed -= 1;
  const nth = Math.max(gap === 0 ? passed : passed + 1, 1);
  const next =
    gap >= 0 ? thisYear : new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
  const n = diffDays(t, next);
  const y = next.getFullYear();
  const sub = `${y}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  return {
    num: n > 0 ? `还有 ${n} 天` : "就是今天",
    tag: annual ? `第 ${nth} 周年 · 每年` : `第 ${nth} 周年`,
    sub,
  };
}
