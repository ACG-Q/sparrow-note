import { useMemo, useState } from "react";
import type { NoteDoc } from "./db/notes";
import { checklistCounts, collectChecklist, type ChecklistEntry } from "./lib/checklist";
import s from "./ChecklistView.module.css";

/**
 * 清单汇总页：把散在各篇笔记里的清单项收在一起，能直接勾。
 *
 * 排序：待办按笔记日期从新到旧，同一篇里保持原来的顺序；
 * 已完成的单独折起来——「待办」是这个页面的主角，完成了就不该继续占位。
 */
export function ChecklistView({
  notes,
  onToggle,
  onOpenNote,
  onBack,
}: {
  notes: NoteDoc[];
  onToggle: (entry: ChecklistEntry) => void;
  onOpenNote: (id: string) => void;
  onBack: () => void;
}) {
  const entries = useMemo(() => collectChecklist(notes), [notes]);
  const counts = useMemo(() => checklistCounts(entries), [entries]);
  const [showDone, setShowDone] = useState(false);

  const { openGroups, doneGroups } = useMemo(() => {
    const sortDesc = (a: ChecklistEntry, b: ChecklistEntry) =>
      a.noteDate < b.noteDate ? 1 : a.noteDate > b.noteDate ? -1 : 0;
    const group = (rows: ChecklistEntry[]) => {
      const map = new Map<string, { noteId: string; noteTitle: string; noteDate: string; items: ChecklistEntry[] }>();
      for (const row of [...rows].sort(sortDesc)) {
        const g = map.get(row.noteId) ?? {
          noteId: row.noteId,
          noteTitle: row.noteTitle,
          noteDate: row.noteDate,
          items: [],
        };
        g.items.push(row);
        map.set(row.noteId, g);
      }
      // 同一篇笔记内部按原顺序（itemIndex）
      for (const g of map.values()) g.items.sort((a, b) => a.itemIndex - b.itemIndex);
      return [...map.values()];
    };
    return {
      openGroups: group(entries.filter((e) => !e.done)),
      doneGroups: group(entries.filter((e) => e.done)),
    };
  }, [entries]);

  return (
    <div className={s.page}>
      <header className={s.phead}>
        <button type="button" className={s.back} onClick={onBack}>
          ← 汇总
        </button>
        <h1>清单</h1>
        <span className={s.pn}>
          待办 {counts.open}
          <i className={s.sep}>·</i>
          已完成 {counts.done}
        </span>
      </header>

      {counts.open === 0 && counts.done === 0 ? (
        <div className={s.emptyBox}>
          <p className={s.empty}>还没有任何清单。</p>
          <p className={s.emptyHint}>
            在笔记里输入 <b>/清单</b> 插一个清单块，里面的条目就会出现在这里。
          </p>
        </div>
      ) : (
        <>
          {openGroups.length === 0 ? (
            <p className={s.allDone}>待办清空了。</p>
          ) : (
            openGroups.map((g) => (
              <section key={g.noteId} className={s.group}>
                <div className={s.ghead}>
                  <button
                    type="button"
                    className={s.gtitle}
                    onClick={() => onOpenNote(g.noteId)}
                    title="打开这篇笔记"
                  >
                    {g.noteTitle || "无标题"}
                  </button>
                  <span className={s.gdate}>{g.noteDate}</span>
                </div>
                {g.items.map((it) => (
                  <label key={`${it.blockId}-${it.itemIndex}`} className={s.row}>
                    <input
                      type="checkbox"
                      className={s.box}
                      checked={it.done}
                      onChange={() => onToggle(it)}
                    />
                    <span className={s.text}>{it.text}</span>
                  </label>
                ))}
              </section>
            ))
          )}

          {counts.done > 0 && (
            <section className={s.group}>
              <button
                type="button"
                className={s.doneToggle}
                aria-expanded={showDone}
                onClick={() => setShowDone((v) => !v)}
              >
                {showDone ? "收起已完成" : "显示已完成"}（{counts.done}）
                <span className={s.chev} aria-hidden="true">
                  {showDone ? "▴" : "▾"}
                </span>
              </button>
              {showDone &&
                doneGroups.map((g) => (
                  <div key={g.noteId} className={s.doneGroup}>
                    <div className={s.ghead}>
                      <button
                        type="button"
                        className={s.gtitle}
                        onClick={() => onOpenNote(g.noteId)}
                        title="打开这篇笔记"
                      >
                        {g.noteTitle || "无标题"}
                      </button>
                      <span className={s.gdate}>{g.noteDate}</span>
                    </div>
                    {g.items.map((it) => (
                      <label key={`${it.blockId}-${it.itemIndex}`} className={`${s.row} ${s.rowDone}`}>
                        <input
                          type="checkbox"
                          className={s.box}
                          checked={it.done}
                          onChange={() => onToggle(it)}
                        />
                        <span className={`${s.text} ${s.textDone}`}>{it.text}</span>
                      </label>
                    ))}
                  </div>
                ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
