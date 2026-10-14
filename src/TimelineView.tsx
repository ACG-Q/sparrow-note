import { useMemo } from "react";
import type { NoteDoc } from "./db/notes";
import { plainTextOfBlocks } from "./lib/aggregate";

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
}: {
  notes: NoteDoc[];
  onOpenNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
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
      <div className="timeline-page">
        <div className="timeline-empty">还没有笔记，点击右下角按钮写下今天的第一条</div>
      </div>
    );
  }

  return (
    <div className="timeline-page">
      {groups.map(([date, items]) => (
        <section key={date} className="timeline-group">
          <h2 className="timeline-date">{formatDay(date)}</h2>
          <div className="timeline-cards">
            {items.map((n) => {
              const ex = excerpt(n);
              return (
                <div
                  key={n.id}
                  className="timeline-card"
                  onClick={() => onOpenNote(n.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpenNote(n.id);
                  }}
                >
                  <div className="timeline-card-title">{n.title || "无标题"}</div>
                  {ex && <div className="timeline-card-excerpt">{ex}</div>}
                  <button
                    className="timeline-card-delete"
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
