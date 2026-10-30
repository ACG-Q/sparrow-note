import { useMemo } from "react";
import type { NoteDoc } from "../db/notes";
import type { NavView } from "../lib/nav";
import { streaks } from "../lib/stats";
import { formatChars, monthPrefixOf, monthSummary } from "../lib/timeline";
import { bodyChars } from "../lib/timeline";
import s from "./NavRail.module.css";

const ITEMS: { key: NavView; label: string; idx: string }[] = [
  { key: "timeline", label: "时间线", idx: "01" },
  { key: "summary", label: "汇总", idx: "02" },
  { key: "profile", label: "我的", idx: "03" },
];

export function NavRail({
  view,
  notes,
  onNavigate,
  onSearch,
  onCreate,
  dark,
  onToggleTheme,
}: {
  view: NavView;
  notes: NoteDoc[];
  onNavigate: (v: NavView) => void;
  onSearch: () => void;
  onCreate: () => void;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const stats = useMemo(() => {
    const prefix = monthPrefixOf(notes);
    const month = monthSummary(notes, prefix);
    const chars = notes.reduce((n, note) => n + bodyChars(note), 0);
    return {
      monthCount: month.count,
      streak: streaks(notes).current,
      chars: formatChars(chars),
    };
  }, [notes]);

  return (
    <aside className={s.rail} aria-label="主导航">
      <div className={s.brand}>
        <span className={s.seal} aria-hidden="true">雀</span>
        <div>
          <h1>麻雀记</h1>
          <p className={s.sub}>Sparrow Note</p>
        </div>
      </div>

      <button className={s.newBtn} onClick={onCreate}>
        ＋ 新笔记
      </button>

      <ul className={s.items}>
        {ITEMS.map(({ key, label, idx }) => (
          <li key={key}>
            <button
              className={(view === key || (view === "checklist" && key === "summary")) ? `${s.item} ${s.itemOn}` : s.item}
              aria-current={(view === key || (view === "checklist" && key === "summary")) ? "page" : undefined}
              onClick={() => onNavigate(key)}
            >
              <span className={s.idx}>{idx}</span>
              <span className={s.label}>{label}</span>
            </button>
          </li>
        ))}
      </ul>

      <button className={s.searchBtn} onClick={onSearch}>
        <span>搜索</span>
        <kbd className={s.kbd}>Ctrl K</kbd>
      </button>

      <div className={s.foot}>
        <div className={s.row}>
          <span>本月</span>
          <b>{stats.monthCount} 篇</b>
        </div>
        <div className={s.row}>
          <span>连续</span>
          <b>{stats.streak} 天</b>
        </div>
        <div className={s.row}>
          <span>字数</span>
          <b>{stats.chars} 字</b>
        </div>
        <div className={s.row}>
          <span>纸面</span>
          <button className={s.themeBtn} onClick={onToggleTheme}>
            {dark ? "日间纸" : "夜间纸"}
          </button>
        </div>
      </div>
    </aside>
  );
}
