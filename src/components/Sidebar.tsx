import { useEffect, useRef, useState } from "react";
import type { NoteDoc } from "../db/notes";
import type { NavView } from "../lib/nav";
import { themeLabel, type ThemePref } from "../lib/theme";
import { GearIcon, MoonIcon, MoreIcon, SummaryIcon, TimelineIcon, UserIcon } from "../ui/icons";
import { NoteList } from "./NoteList";
import s from "./Sidebar.module.css";

export function Sidebar({
  view,
  activeId,
  notes,
  query,
  onQueryChange,
  onNavigate,
  onOpenNote,
  onDeleteNote,
  onCreate,
  themePref,
  onCycleTheme,
}: {
  view: NavView;
  activeId: string | null;
  notes: NoteDoc[];
  query: string;
  onQueryChange: (v: string) => void;
  onNavigate: (v: NavView) => void;
  onOpenNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onCreate: () => void;
  themePref: ThemePref;
  onCycleTheme: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <aside className={s.sidebar}>
      <div className={s.head}>
        <span className={s.logo}>麻雀记</span>
        <button className={s.newBtn} onClick={onCreate}>
          ＋ 新笔记
        </button>
      </div>
      <nav className={s.nav}>
        <button
          className={view === "timeline" ? `${s.navItem} ${s.navActive}` : s.navItem}
          onClick={() => onNavigate("timeline")}
        >
          <TimelineIcon />
          <span>时间线</span>
        </button>
        <button
          className={view === "summary" ? `${s.navItem} ${s.navActive}` : s.navItem}
          onClick={() => onNavigate("summary")}
        >
          <SummaryIcon />
          <span>汇总</span>
        </button>
      </nav>
      <div className={s.divider} />
      <div className={s.notes}>
        <NoteList
          notes={notes}
          activeId={activeId}
          query={query}
          onQueryChange={onQueryChange}
          onOpenNote={onOpenNote}
          onDeleteNote={onDeleteNote}
          onCreate={onCreate}
        />
      </div>
      <div className={s.account} ref={menuRef}>
        <button
          className={view === "profile" ? `${s.accountRow} ${s.navActive}` : s.accountRow}
          onClick={() => onNavigate("profile")}
        >
          <span className={s.avatar}>
            <UserIcon />
          </span>
          <span>我的</span>
        </button>
        <button
          className={s.moreBtn}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="账号菜单"
        >
          <MoreIcon />
        </button>
        {menuOpen && (
          <div className={s.menu}>
            <button
              className={s.menuItem}
              onClick={() => {
                onCycleTheme();
                setMenuOpen(false);
              }}
            >
              <MoonIcon />
              <span className={s.menuText}>切换主题</span>
              <span className={s.menuValue}>{themeLabel(themePref)}</span>
            </button>
            <button
              className={s.menuItem}
              onClick={() => {
                onNavigate("profile");
                setMenuOpen(false);
              }}
            >
              <GearIcon />
              <span className={s.menuText}>打开设置</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
