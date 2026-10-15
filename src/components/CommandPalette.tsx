import { useEffect, useRef } from "react";
import type { NoteDoc } from "../db/notes";
import { SearchIcon } from "../ui/icons";
import s from "./CommandPalette.module.css";

export function CommandPalette({
  open,
  notes,
  query,
  onQueryChange,
  onOpenNote,
  onClose,
}: {
  open: boolean;
  notes: NoteDoc[];
  query: string;
  onQueryChange: (v: string) => void;
  onOpenNote: (id: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const results = notes.slice(0, 8);

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.panel} onClick={(e) => e.stopPropagation()}>
        <div className={s.searchRow}>
          <SearchIcon />
          <input
            ref={inputRef}
            className={s.input}
            placeholder="搜索笔记…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) onOpenNote(results[0].id);
            }}
          />
        </div>
        <div className={s.list}>
          {results.length === 0 ? (
            <div className={s.empty}>无匹配结果，试试其他关键词</div>
          ) : (
            results.map((n) => (
              <button key={n.id} className={s.item} onClick={() => onOpenNote(n.id)}>
                <span className={s.itemTitle}>{n.title || "无标题"}</span>
                <span className={s.itemDate}>{n.date}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
