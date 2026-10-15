import { useMemo } from "react";
import type { NoteDoc } from "../db/notes";
import { CloseIcon, SearchIcon } from "../ui/icons";
import s from "./NoteList.module.css";

export function NoteList({
  notes,
  activeId,
  query,
  onQueryChange,
  onOpenNote,
  onDeleteNote,
  onCreate,
}: {
  notes: NoteDoc[];
  activeId: string | null;
  query: string;
  onQueryChange: (v: string) => void;
  onOpenNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onCreate: () => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, NoteDoc[]>();
    for (const n of notes) {
      const key = n.date.slice(0, 7);
      const arr = map.get(key);
      if (arr) arr.push(n);
      else map.set(key, [n]);
    }
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, items]) => ({
        month,
        items: [...items].sort((x, y) => y.updatedAt - x.updatedAt),
      }));
  }, [notes]);

  const searching = query.trim().length > 0;

  return (
    <div className={s.wrap}>
      <div className={s.searchRow}>
        <span className={s.searchIcon}>
          <SearchIcon />
        </span>
        <input
          className={s.searchInput}
          placeholder="搜索笔记…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      {notes.length === 0 ? (
        <div className={s.empty}>
          <div>{searching ? "没有匹配的笔记" : "暂无笔记"}</div>
          {!searching && (
            <button className={s.emptyNew} onClick={onCreate}>
              新建一条
            </button>
          )}
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.month}>
            <div className={s.groupHead}>{g.month.replace("-", "年") + "月"}</div>
            {g.items.map((n) => (
              <div
                key={n.id}
                className={n.id === activeId ? `${s.row} ${s.rowActive}` : s.row}
                role="button"
                tabIndex={0}
                onClick={() => onOpenNote(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpenNote(n.id);
                }}
              >
                <span className={s.rowTitle}>{n.title || "无标题"}</span>
                <span className={s.rowMeta}>
                  <span className={s.rowDate}>{n.date}</span>
                  <button
                    className={s.rowDelete}
                    aria-label="删除"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNote(n.id);
                    }}
                  >
                    <CloseIcon />
                  </button>
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
