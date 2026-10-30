import { useMemo, useState } from "react";
import type { NoteDoc } from "../db/notes";
import { dateKey } from "../lib/stats";
import { useSettings } from "../lib/settings";
import {
  bodyChars,
  bodyText,
  dayParts,
  formatChars,
  groupByDay,
  hasBlockType,
  monthLabel,
  monthPrefixOf,
  monthSummary,
  moodParts,
  timeOf,
} from "../lib/timeline";
import s from "./ListColumn.module.css";

type Filter = "all" | "photo" | "day";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "photo", label: "有图" },
  { key: "day", label: "纪念日" },
];

export function ListColumn({
  notes,
  activeId,
  onOpenNote,
  onCreate,
}: {
  notes: NoteDoc[];
  activeId: string | null;
  onOpenNote: (id: string) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const settings = useSettings();

  const visible = useMemo(() => {
    if (filter === "photo") return notes.filter((n) => hasBlockType(n, "image"));
    if (filter === "day") return notes.filter((n) => hasBlockType(n, "anniversary"));
    return notes;
  }, [notes, filter]);

  const groups = useMemo(() => groupByDay(visible), [visible]);
  const texts = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of visible) map.set(n.id, bodyText(n));
    return map;
  }, [visible]);

  const prefix = monthPrefixOf(notes);
  const label = monthLabel(prefix);
  const summary = monthSummary(visible, prefix);
  const today = dateKey(new Date());

  const headGroups = groups.filter((g) => g.date.startsWith(prefix));
  const olderGroups = groups.filter((g) => g.date < `${prefix}-01`);

  const day = (items: NoteDoc[], date: string) => {
    const { day: dd, week } = dayParts(date);
    return (
      <section key={date} className={s.day}>
        <div className={date === today ? `${s.mark} ${s.today}` : s.mark}>
          <span className={s.d}>{dd}</span>
          <span className={s.w}>{week}</span>
        </div>
        <div className={s.items}>
          {items.map((note) => {
            const mood = moodParts(note);
            return (
              <button
                key={note.id}
                type="button"
                className={activeId === note.id ? `${s.entry} ${s.entryOn}` : s.entry}
                aria-current={activeId === note.id ? "true" : undefined}
                onClick={() => onOpenNote(note.id)}
              >
                <span className={s.t}>{note.title || "无标题"}</span>
                {(texts.get(note.id) ?? "") && (
                  <span className={s.x}>{texts.get(note.id)}</span>
                )}
                <span className={s.m}>
                  <span>{timeOf(note)}</span>
                  {settings.showMoodMeta && mood.char && (
                    <>
                      <i>·</i>
                      <span>
                        <span className={s.moodMark}>{mood.char}</span>
                        {mood.text ? ` ${mood.text}` : ""}
                      </span>
                    </>
                  )}
                  <i>·</i>
                  <span>{bodyChars(note)} 字</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <aside className={s.list} aria-label="笔记目录">
      <div className={s.head}>
        <div className={s.month}>
          <span className={s.num}>{label.month}</span>
          <span className={s.cn}>{label.cn}</span>
          <span className={s.en}>{label.en}</span>
        </div>
        <p className={s.counts}>
          {summary.count} 篇 · {summary.days} 天 · {formatChars(summary.chars)} 字
        </p>
        <div className={s.filters} role="group" aria-label="筛选">
          {FILTERS.map(({ key, label: text }) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      <div className={s.scroll}>
        {headGroups.length === 0 && (
          <div className={s.empty}>
            <p>这个月还没有记录</p>
            <button onClick={onCreate}>写一条</button>
          </div>
        )}
        {headGroups.map((g) => day(g.notes, g.date))}

        {olderGroups.length > 0 && (
          <div className={s.older}>
            <span>更早</span>
          </div>
        )}
        {olderGroups.map((g) => day(g.notes, g.date))}

        {visible.length > 0 && (
          <p className={s.end}>
            <span className={s.sq} />
            {label.cn} · 共 {summary.count} 篇
            <span className={s.sq} />
          </p>
        )}
      </div>
    </aside>
  );
}
