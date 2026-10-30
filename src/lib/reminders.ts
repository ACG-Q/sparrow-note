const DAY_MS = 86400000;

export type ReminderBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
};

export type ReminderNote = {
  id: string;
  title: string;
  date: string;
  blocks: unknown;
};

export type ReminderHit = {
  /** 去重键：笔记 + 块 + 这次提醒对应的事件日期 */
  key: string;
  noteId: string;
  noteTitle: string;
  blockId: string;
  title: string;
  /** 事件当天的日期（YYYY-MM-DD） */
  due: string;
  /** 距离还有几天，0 = 今天 */
  days: number;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseDate(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 下一次发生的那一天：每年重复的取今年或明年，其它取原日期 */
export function nextOccurrence(date: string, annual: boolean, today = new Date()): Date | null {
  const d = parseDate(date);
  if (!d) return null;
  const t = startOfDay(today);
  if (!annual) return d;
  const thisYear = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (thisYear.getTime() >= t.getTime()) return thisYear;
  return new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
}

/**
 * 找出该提醒的纪念日。
 * 只处理「纪念日」和「倒计时」；正计时是起点日，不该提醒。
 */
export function dueReminders(
  notes: ReminderNote[],
  opts: { today?: Date; withinDays?: number } = {},
): ReminderHit[] {
  const today = startOfDay(opts.today ?? new Date());
  const within = Math.max(0, opts.withinDays ?? 0);
  const hits: ReminderHit[] = [];

  for (const note of notes) {
    const blocks = Array.isArray(note.blocks) ? (note.blocks as ReminderBlock[]) : [];
    for (const b of blocks) {
      if (!b || b.type !== "anniversary") continue;
      const props = b.props ?? {};
      if (str(props.remind) !== "on") continue;
      const kind = str(props.kind) || "anniversary";
      if (kind === "count") continue;
      const date = str(props.date);
      const annual = props.annual !== false;
      const due = nextOccurrence(date, annual, today);
      if (!due) continue;
      const days = Math.round((due.getTime() - today.getTime()) / DAY_MS);
      const ahead = Number(str(props.remindDays) || "0");
      const limit = Number.isFinite(ahead) ? ahead : within;
      if (days < 0 || days > limit) continue;
      hits.push({
        key: `${note.id}:${b.id}:${ymd(due)}`,
        noteId: note.id,
        noteTitle: note.title,
        blockId: b.id,
        title: str(props.title) || note.title || "纪念日",
        due: ymd(due),
        days,
      });
    }
  }
  return hits.sort((a, b) => a.days - b.days);
}

/** 提醒文案：今天 / 还有 N 天 */
export function reminderText(hit: ReminderHit): { title: string; body: string } {
  const when = hit.days === 0 ? "就是今天" : `还有 ${hit.days} 天`;
  return {
    title: `${hit.title} · ${when}`,
    body: hit.noteTitle && hit.noteTitle !== hit.title ? `来自《${hit.noteTitle}》 · ${hit.due}` : hit.due,
  };
}
