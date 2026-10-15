import { useMemo } from "react";
import type { NoteDoc } from "./db/notes";
import { plainTextOfBlocks } from "./lib/aggregate";
import s from "./TimelineView.module.css";

function formatDay(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${Number(m[2])} 月 ${Number(m[3])} 日 · 周${week}`;
}

function excerpt(note: NoteDoc): string {
  const text = plainTextOfBlocks(note.blocks).replace(/\s+/g, " ").trim();
  return text.slice(0, 80);
}

export function TimelineView({
  notes,
  onOpenNote,
  onDeleteNote,
  onCreate,
}: {
  notes: NoteDoc[];
  onOpenNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onCreate: () => void;
}) {
  const groups = useMemo(() => {
    const sorted = [...notes].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt,
    );
    const map = new Map<string, NoteDoc[]>();
    for (const n of sorted) {
      const list = map.get(n.date);
      if (list) list.push(n);
      else map.set(n.date, [n]);
    }
    return Array.from(map.entries());
  }, [notes]);

  if (notes.length === 0) {
    return (
      <div className={s.page}>
        <div className={s.empty}>
          <div>还没有笔记</div>
          <button className={s.emptyNew} onClick={onCreate}>
            ＋ 新建一条
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      {groups.map(([date, items]) => (
        <section key={date} className={s.group}>
          <h2 className={s.date}>{formatDay(date)}</h2>
          <div className={s.cards}>
            {items.map((n) => {
              const ex = excerpt(n);
              return (
                <div
                  key={n.id}
                  className={s.card}
                  onClick={() => onOpenNote(n.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpenNote(n.id);
                  }}
                >
                  <div className={s.cardTitle}>{n.title || "无标题"}</div>
                  {ex && <div className={s.cardExcerpt}>{ex}</div>}
                  <button
                    className={s.cardDelete}
                    title="删除"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNote(n.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
