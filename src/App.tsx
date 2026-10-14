import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteNote, listNotes, putNote, type NoteDoc } from "./db/notes";
import { NoteEditor } from "./editor/NoteEditor";
import { SummaryView } from "./SummaryView";
import { ProfileView } from "./ProfileView";
import { TimelineView } from "./TimelineView";
import { noteMatchesQuery } from "./lib/aggregate";
import { resolveDark, useThemePref } from "./lib/theme";
import { MenuIcon, UserIcon } from "./ui/icons";

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
  const [view, setView] = useState<"timeline" | "note" | "summary" | "profile">("timeline");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const themePref = useThemePref();

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

  const bootRef = useRef(false);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    listNotes().then((all) => {
      if (all.length === 0) {
        const note = newNote();
        putNote(note).then(() => {
          setNotes([note]);
          setActiveId(note.id);
          setLoaded(true);
        });
      } else {
        setNotes(all);
        setActiveId(all[0].id);
        setLoaded(true);
      }
    });
  }, []);

  const active = notes.find((n) => n.id === activeId) ?? null;

  const visibleNotes = useMemo(
    () =>
      notes.filter((n) => {
        if (dateFilter && n.date !== dateFilter) return false;
        return noteMatchesQuery(n, query);
      }),
    [notes, query, dateFilter],
  );

  const handleCreate = useCallback(() => {
    const note = newNote();
    putNote(note).then(() => {
      setNotes((prev) => [note, ...prev]);
      setActiveId(note.id);
      setView("note");
      setSidebarOpen(false);
    });
  }, []);

  const openTimeline = useCallback(() => {
    setView("timeline");
    setSidebarOpen(false);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteNote(id).then(() => {
        setNotes((prev) => {
          const next = prev.filter((n) => n.id !== id);
          if (activeId === id) {
            setActiveId(next[0]?.id ?? null);
          }
          if (next.length === 0) {
            const note = newNote();
            putNote(note);
            setActiveId(note.id);
            return [note];
          }
          return next;
        });
      });
    },
    [activeId],
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

  const openNote = useCallback((id: string) => {
    setActiveId(id);
    setView("note");
    setSidebarOpen(false);
  }, []);

  const reloadNotes = useCallback(() => {
    listNotes().then((all) => {
      setNotes(all);
      setActiveId(all[0]?.id ?? null);
      setView("note");
    });
  }, []);

  if (!loaded) return <div className="app-loading">加载中…</div>;

  return (
    <div className={sidebarOpen ? "app sidebar-open" : "app"}>
      <div className="topbar">
        <button
          className="btn-menu"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label="菜单"
        >
          <MenuIcon />
        </button>
        <span className="topbar-title">
          {view === "summary"
            ? "汇总"
            : view === "profile"
              ? "我的"
              : view === "timeline"
                ? "时间线"
                : active?.title || "无标题"}
        </span>
        <button className="btn-new" onClick={handleCreate}>
          ＋
        </button>
      </div>
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="app-name">麻雀记</span>
          <button className="btn-new btn-new-full" onClick={handleCreate}>
            ＋ 新笔记
          </button>
        </div>
        <div className="sidebar-filters">
          <input
            className="search-input"
            placeholder="搜索标题或正文…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filter-row">
            <input
              className="date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="按日期筛选"
            />
            {(query || dateFilter) && (
              <button
                className="btn-clear"
                onClick={() => {
                  setQuery("");
                  setDateFilter("");
                }}
              >
                清除
              </button>
            )}
          </div>
        </div>
        <button
          className={view === "timeline" ? "btn-summary active" : "btn-summary"}
          onClick={openTimeline}
        >
          时间线
        </button>
        <button
          className={view === "summary" ? "btn-summary active" : "btn-summary"}
          onClick={() => {
            setView(view === "summary" ? "timeline" : "summary");
            setSidebarOpen(false);
          }}
        >
          汇总视图
        </button>
        <button
          className={view === "profile" ? "btn-summary active" : "btn-summary"}
          onClick={() => {
            setView("profile");
            setSidebarOpen(false);
          }}
        >
          <span className="btn-summary-icon">
            <UserIcon />
          </span>
          我的
        </button>
        <nav className="note-list">
          {visibleNotes.length === 0 && (
            <div className="note-list-empty">没有匹配的笔记</div>
          )}
          {visibleNotes.map((n) => (
            <div
              key={n.id}
              className={n.id === activeId ? "note-item active" : "note-item"}
              onClick={() => openNote(n.id)}
            >
              <div className="note-item-title">
                {n.title || "无标题"}
              </div>
              <div className="note-item-meta">
                <span>{n.date}</span>
                <button
                  className="btn-delete"
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(n.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      <main className="main">
        {view === "timeline" ? (
          <TimelineView
            notes={visibleNotes}
            onOpenNote={openNote}
            onDeleteNote={handleDelete}
          />
        ) : view === "summary" ? (
          <SummaryView notes={notes} onOpenNote={openNote} />
        ) : view === "profile" ? (
          <ProfileView notes={notes} onDataCleared={reloadNotes} />
        ) : active ? (
          <div className="editor-page" key={active.id}>
            <div className="editor-header">
              <input
                className="title-input"
                placeholder="无标题"
                value={active.title}
                onChange={(e) => handleTitleChange(e.target.value)}
              />
              <div className="editor-date">
                <input
                  className="date-input"
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
            <NoteEditor
              initialContent={active.blocks}
              onChange={handleBlocksChange}
            />
          </div>
        ) : (
          <div className="empty-state">选择或创建一条笔记</div>
        )}
        {view === "timeline" && (
          <button className="fab" onClick={handleCreate} aria-label="新建今日笔记">
            ＋
          </button>
        )}
      </main>
    </div>
  );
}
