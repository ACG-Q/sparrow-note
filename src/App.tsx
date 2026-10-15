import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteNote, listNotes, putNote, type NoteDoc } from "./db/notes";
import { NoteEditor } from "./editor/NoteEditor";
import { SummaryView } from "./SummaryView";
import { ProfileView } from "./ProfileView";
import { TimelineView } from "./TimelineView";
import { Sidebar } from "./components/Sidebar";
import { NoteList } from "./components/NoteList";
import { BottomTabs } from "./components/BottomTabs";
import { NoteDrawer } from "./components/NoteDrawer";
import { CommandPalette } from "./components/CommandPalette";
import { noteMatchesQuery } from "./lib/aggregate";
import type { NavView } from "./lib/nav";
import { noteHash, parseNoteHash } from "./lib/nav";
import { nextThemePref, resolveDark, setThemePref, useThemePref } from "./lib/theme";
import {
  CardIcon,
  ChevronLeftIcon,
  ListIcon,
  MenuIcon,
  MoreIcon,
  SearchIcon,
} from "./ui/icons";
import s from "./App.module.css";

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function newNote(): NoteDoc {
  return {
    id: crypto.randomUUID(),
    title: "",
    date: today(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    blocks: [],
  };
}

export default function App() {
  const [notes, setNotes] = useState<NoteDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<NavView>("timeline");
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [listMode, setListMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const themePref = useThemePref();
  const dateInputRef = useRef<HTMLInputElement>(null);
  const pushedRef = useRef(false);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const [isNarrow, setIsNarrow] = useState(
    () => window.matchMedia("(max-width: 768px)").matches,
  );

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveDark(themePref) ? "dark" : "light";
    };
    apply();
    if (themePref !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [themePref]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    listNotes().then((all) => {
      setNotes(all);
      const fromHash = parseNoteHash(window.location.hash);
      setActiveId(fromHash && all.some((n) => n.id === fromHash) ? fromHash : null);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    const sync = () => {
      const id = parseNoteHash(window.location.hash);
      setActiveId(id && notesRef.current.some((n) => n.id === id) ? id : null);
      setMenuOpen(false);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setMenuOpen(false);
        setPaletteOpen(false);
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const active = activeId ? notes.find((n) => n.id === activeId) ?? null : null;
  const editing = active !== null;

  const visibleNotes = useMemo(
    () => notes.filter((n) => noteMatchesQuery(n, query)),
    [notes, query],
  );

  const openNote = useCallback((id: string) => {
    const target = noteHash(id);
    if (window.location.hash !== target) {
      window.history.pushState(null, "", target);
      pushedRef.current = true;
    }
    setActiveId(id);
    setDrawerOpen(false);
    setPaletteOpen(false);
    setMenuOpen(false);
  }, []);

  const closeNote = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
      return;
    }
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    setActiveId(null);
  }, []);

  const navigate = useCallback((v: NavView) => {
    setView(v);
    setDrawerOpen(false);
    setMenuOpen(false);
  }, []);

  const handleCreate = useCallback(() => {
    const note = newNote();
    putNote(note).then(() => {
      setNotes((prev) => [note, ...prev]);
      setQuery("");
      openNote(note.id);
    });
  }, [openNote]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteNote(id).then(() => {
        const next = notesRef.current.filter((n) => n.id !== id);
        setNotes(next);
        if (activeId !== id) return;
        if (next.length > 0) {
          openNote(next[0].id);
        } else {
          const note = newNote();
          putNote(note).then(() => {
            setNotes([note]);
            openNote(note.id);
          });
        }
      });
    },
    [activeId, openNote],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!active) return;
      const updated = { ...active, title, updatedAt: Date.now() };
      putNote(updated);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    },
    [active],
  );

  const handleBlocksChange = useCallback(
    (blocks: NoteDoc["blocks"]) => {
      if (!active) return;
      const updated = { ...active, blocks, updatedAt: Date.now() };
      putNote(updated);
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    },
    [active],
  );

  const reloadNotes = useCallback(() => {
    listNotes().then((all) => {
      setNotes(all);
      setActiveId(null);
      pushedRef.current = false;
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    });
  }, []);

  const cycleTheme = useCallback(() => {
    setThemePref(nextThemePref(themePref));
  }, [themePref]);

  const pickDate = useCallback((date: string) => {
    setQuery(date);
    setListMode(true);
    setView("timeline");
    setDrawerOpen(false);
  }, []);

  if (!loaded) return <div className={s.loading}>加载中…</div>;

  const title = editing
    ? active?.title || "无标题"
    : view === "summary"
      ? "汇总"
      : view === "profile"
        ? "我的"
        : "时间线";

  return (
    <div className={s.app}>
      <Sidebar
        view={view}
        activeId={activeId}
        notes={visibleNotes}
        query={query}
        onQueryChange={setQuery}
        onNavigate={navigate}
        onOpenNote={openNote}
        onDeleteNote={handleDelete}
        onCreate={handleCreate}
        themePref={themePref}
        onCycleTheme={cycleTheme}
      />
      <div className={s.mainCol}>
        <header className={s.topbar}>
          {editing ? (
            <>
              <button className={s.btnIcon} onClick={closeNote} aria-label="返回">
                <ChevronLeftIcon />
              </button>
              <span className={s.topbarTitle}>{title}</span>
              <button
                className={`${s.btnIcon} ${s.onlyMobile}`}
                onClick={() => setDrawerOpen(true)}
                aria-label="菜单"
              >
                <MenuIcon />
              </button>
              <div className={s.menuWrap}>
                <button
                  className={`${s.btnIcon} ${s.onlyMobile}`}
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="更多操作"
                >
                  <MoreIcon />
                </button>
                {menuOpen && (
                  <>
                    <div className={s.popBackdrop} onClick={() => setMenuOpen(false)} />
                    <div className={s.popMenu}>
                      <button
                        className={s.popItem}
                        onClick={() => {
                          dateInputRef.current?.focus();
                          setMenuOpen(false);
                        }}
                      >
                        改日期
                      </button>
                      {active && (
                        <button
                          className={`${s.popItem} ${s.popItemDanger}`}
                          onClick={() => {
                            handleDelete(active.id);
                            setMenuOpen(false);
                          }}
                        >
                          删除笔记
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button
                className={`${s.btnIcon} ${s.onlyDesktop}`}
                onClick={() => setPaletteOpen(true)}
                aria-label="搜索"
              >
                <SearchIcon />
              </button>
            </>
          ) : (
            <>
              <button
                className={`${s.btnIcon} ${s.onlyMobile}`}
                onClick={() => setDrawerOpen(true)}
                aria-label="菜单"
              >
                <MenuIcon />
              </button>
              <span className={s.topbarTitle}>{title}</span>
              {view === "timeline" && (
                <button
                  className={`${s.btnIcon} ${s.onlyMobile}`}
                  onClick={() => setListMode((v) => !v)}
                  aria-label={listMode ? "切换到卡片流" : "切换到列表"}
                  title={listMode ? "卡片流" : "紧凑列表"}
                >
                  {listMode ? <CardIcon /> : <ListIcon />}
                </button>
              )}
              <button
                className={`${s.btnIcon} ${s.onlyDesktop}`}
                onClick={() => setPaletteOpen(true)}
                aria-label="搜索"
              >
                <SearchIcon />
              </button>
            </>
          )}
        </header>
        <main className={s.main}>
          {active ? (
            <div className={s.editorPage} key={active.id}>
              <div className={s.editorHeader}>
                <input
                  className={s.titleInput}
                  placeholder="无标题"
                  value={active.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
                <div>
                  <input
                    ref={dateInputRef}
                    className={s.dateInput}
                    type="date"
                    value={active.date}
                    onChange={(e) => {
                      const updated = { ...active, date: e.target.value, updatedAt: Date.now() };
                      putNote(updated);
                      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
                    }}
                  />
                </div>
              </div>
              <NoteEditor initialContent={active.blocks} onChange={handleBlocksChange} />
            </div>
          ) : view === "timeline" ? (
            isNarrow && listMode ? (
              <div className={s.listMode}>
                <NoteList
                  notes={visibleNotes}
                  activeId={activeId}
                  query={query}
                  onQueryChange={setQuery}
                  onOpenNote={openNote}
                  onDeleteNote={handleDelete}
                  onCreate={handleCreate}
                />
              </div>
            ) : (
              <TimelineView
                notes={visibleNotes}
                onOpenNote={openNote}
                onDeleteNote={handleDelete}
                onCreate={handleCreate}
              />
            )
          ) : view === "summary" ? (
            <SummaryView notes={notes} onOpenNote={openNote} />
          ) : (
            <ProfileView notes={notes} onDataCleared={reloadNotes} />
          )}
        </main>
      </div>
      {!editing && <BottomTabs view={view} onNavigate={navigate} />}
      {!editing && view === "timeline" && (
        <button className={s.fab} onClick={handleCreate} aria-label="新建笔记">
          ＋
        </button>
      )}
      <NoteDrawer
        open={drawerOpen}
        notes={notes}
        themePref={themePref}
        onCycleTheme={cycleTheme}
        onClose={() => setDrawerOpen(false)}
        onCreate={handleCreate}
        onOpenSettings={() => navigate("profile")}
        onPickDate={pickDate}
      />
      <CommandPalette
        open={paletteOpen}
        notes={visibleNotes}
        query={query}
        onQueryChange={setQuery}
        onOpenNote={openNote}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
