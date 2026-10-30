import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri, type NoteDoc } from "./db/notes";
import { useAnniversaryReminders } from "./lib/useAnniversaryReminders";
import { useDeskPrefs, useNarrowViewport, useSaveIndicator } from "./app/useDeskPrefs";
import { useShareActions } from "./app/useShareActions";
import { useNoteWorkspace } from "./app/useNoteWorkspace";
import { LoadFail } from "./app/LoadFail";
import { MainPane } from "./app/MainPane";
import { MobileTopbar } from "./app/MobileTopbar";
import { NavRail } from "./components/NavRail";
import { ListColumn } from "./components/ListColumn";
import { Viewbar } from "./components/Viewbar";
import { BottomTabs } from "./components/BottomTabs";
import { NoteDrawer } from "./components/NoteDrawer";
import { CommandPalette } from "./components/CommandPalette";
import { UndoToast } from "./components/UndoToast";
import type { NavView } from "./lib/nav";
import { getSettings } from "./lib/settings";
import { nextThemePref, resolveDark, setThemePref, useThemePref } from "./lib/theme";
import s from "./App.module.css";

export default function App() {
  useAnniversaryReminders();
  const ws = useNoteWorkspace();
  const {
    notes,
    activeId,
    active,
    loaded,
    loadError,
    loadNotes,
    reloadNotes,
    selectNote,
    clearSelection,
    createNote,
    deleteNote: removeNote,
    saveFailure,
    retrySave,
    dismissSaveFailure,
    undoDelete,
    undoDeleteNote: restoreDeletedNote,
    dismissUndo,
    toggleChecklistItem,
    changeTitle,
    changeBlocks,
    updateNote,
    visibleNotes: filterVisibleNotes,
    sorted,
    prevNote,
    nextNote,
    noteNumber,
  } = ws;
  const [view, setView] = useState<NavView>("timeline");
  const [query, setQuery] = useState("");
  /** 日期筛选：点热力格/日历选中的那一天，空串表示不筛选。
      与搜索词 query 各自独立，列表里两者同时生效（AND）。 */
  const [dateFilter, setDateFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePage, setProfilePage] = useState<"settings" | "personalize" | "permissions" | "about" | null>(null);
  const { navOn, listOn, locked, setNavOn, setListOn, setLocked } = useDeskPrefs();
  const [readMode, setReadMode] = useState(true);
  const themePref = useThemePref();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const isNarrow = useNarrowViewport();

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

  // —— 视图与面板的联动留在 App；笔记本身由 useNoteWorkspace 管 ——
  const openNote = useCallback(
    (id: string) => {
      const note = notes.find((n) => n.id === id);
      setReadMode(
        Boolean(note && note.blocks.length > 0 && getSettings().defaultNoteMode === "read"),
      );
      setProfilePage(null);
      selectNote(id);
      setDrawerOpen(false);
      setPaletteOpen(false);
      setMenuOpen(false);
    },
    [notes, selectNote],
  );

  const closeNote = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const navigate = useCallback(
    (v: NavView) => {
      closeNote();
      setProfilePage(null);
      setView(v);
      setDrawerOpen(false);
      setMenuOpen(false);
    },
    [closeNote],
  );

  const handleCreate = useCallback(() => {
    createNote((id) => {
      // 新写的这条是今天的，留着旧筛选会把它挡在时间线外面
      setQuery("");
      setDateFilter("");
      openNote(id);
    });
  }, [createNote, openNote]);

  /** 删除：可逆操作，先删 + 5 秒撤销（详见 useNoteWorkspace 注释） */
  const handleDelete = useCallback(
    (id: string) => {
      removeNote(id, (fallbackId) => {
        if (fallbackId) {
          openNote(fallbackId);
        } else {
          // 删空了：补一条新的，避免整屏空白
          createNote((newId) => openNote(newId));
        }
      });
    },
    [removeNote, openNote, createNote],
  );

  const undoDeleteNote = useCallback(() => {
    restoreDeletedNote((id) => openNote(id));
  }, [restoreDeletedNote, openNote]);

  const cycleTheme = useCallback(() => {
    setThemePref(nextThemePref(themePref));
  }, [themePref]);

  const toggleTheme = useCallback(() => {
    setThemePref(resolveDark(themePref) ? "light" : "dark");
  }, [themePref]);

  // 选日期只写日期筛选，不碰搜索词：两者是两件事
  const pickDate = useCallback((date: string) => {
    setDateFilter(date);
    setView("timeline");
    setDrawerOpen(false);
  }, []);

  // 原生 date 控件只负责弹出选择器；显示交给上方按钮
  const openDatePicker = useCallback(() => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // 浏览器拒绝（未获得用户激活等）时退回聚焦
      }
    }
    el.focus();
  }, []);

  const { saveState, markSave } = useSaveIndicator();
  const { shareMarkdown, shareMarkdownZip, sharePdf, sharePng, sharePrint, shareHint } =
    useShareActions(active);

  /** 清单页勾一项：和正文编辑同一条保存链路 */
  const handleToggleChecklist = useCallback(
    (entry: Parameters<typeof toggleChecklistItem>[0]) => {
      toggleChecklistItem(entry, markSave);
    },
    [toggleChecklistItem, markSave],
  );

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      changeTitle(nextTitle, markSave);
    },
    [changeTitle, markSave],
  );

  const handleBlocksChange = useCallback(
    (blocks: NoteDoc["blocks"]) => {
      changeBlocks(blocks, markSave);
    },
    [changeBlocks, markSave],
  );

  const visibleNotes = useMemo(
    () => filterVisibleNotes(query, dateFilter),
    [filterVisibleNotes, query, dateFilter],
  );
  // 目录栏收起来时，空态里补一份最近几篇，避免整屏只有一枚印章
  const recent = useMemo(() => (listOn ? [] : sorted.slice(0, 6)), [listOn, sorted]);

  // 全局快捷键：⌘/Ctrl+K 命令面板、Esc 收面板、（dev）F12 开发者工具
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
      if (
        import.meta.env.DEV &&
        isTauri() &&
        (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "i"))
      ) {
        e.preventDefault();
        void invoke("plugin:webview|internal_toggle_devtools", {
          label: getCurrentWindow().label,
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!loaded) return <div className={s.loading}>加载中…</div>;

  // 读库失败：给原因 + 重试，别让界面停在空白
  if (loadError) {
    return <LoadFail error={loadError} onRetry={() => void loadNotes()} />;
  }

  const editing = active !== null;

  const title = editing
    ? active?.title || "无标题"
    : view === "summary"
      ? "汇总"
      : view === "profile"
        ? "我的"
        : "时间线";

  const mainContent = (
    <MainPane
      active={active}
      view={view}
      isNarrow={isNarrow}
      readMode={readMode}
      saveState={saveState}
      shareHint={shareHint}
      noteNumber={noteNumber}
      prevNote={prevNote}
      nextNote={nextNote}
      listOn={listOn}
      recent={recent}
      visibleNotes={visibleNotes}
      query={query}
      dateFilter={dateFilter}
      profilePage={profilePage}
      dark={resolveDark(themePref)}
      dateInputRef={dateInputRef}
      onOpenDatePicker={openDatePicker}
      onUpdateNote={updateNote}
      markSave={markSave}
      onTitleChange={handleTitleChange}
      onBlocksChange={handleBlocksChange}
      onOpenNote={openNote}
      onCreate={handleCreate}
      onToggleList={setListOn}
      onQueryChange={setQuery}
      onDateChange={setDateFilter}
      onOpenDrawer={() => setDrawerOpen(true)}
      onProfilePage={setProfilePage}
      onNavigate={navigate}
      onToggleChecklist={handleToggleChecklist}
      onDataCleared={reloadNotes}
      onToggleTheme={toggleTheme}
    />
  );

  if (isNarrow) {
    return (
      <div className={s.app}>
        <div className={s.mainCol}>
          {editing && (
            <MobileTopbar
              active={active}
              title={title}
              readMode={readMode}
              menuOpen={menuOpen}
              onBack={closeNote}
              onOpenDrawer={() => setDrawerOpen(true)}
              onToggleRead={() => setReadMode((v) => !v)}
              onToggleMenu={() => setMenuOpen((v) => !v)}
              onCloseMenu={() => setMenuOpen(false)}
              onOpenDatePicker={openDatePicker}
              onShareMd={shareMarkdown}
              onShareMdZip={shareMarkdownZip}
              onSharePdf={sharePdf}
              onSharePng={sharePng}
              onPrint={sharePrint}
              onDelete={handleDelete}
            />
          )}
          <main className={s.main}>{mainContent}</main>
        </div>

        {!editing && <BottomTabs view={view} onNavigate={navigate} />}
        {!editing && view === "timeline" && (
          <button className={s.fab} onClick={handleCreate} aria-label="新建笔记">
            写
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
          onClearFilter={() => setDateFilter("")}
        />
        {undoDelete && (
          <UndoToast
            message="已删除这篇笔记"
            onAction={undoDeleteNote}
            onDismiss={dismissUndo}
          />
        )}
        {saveFailure && (
          <UndoToast
            message={`没存上：${saveFailure.reason}`}
            actionLabel="重试"
            onAction={retrySave}
            onDismiss={dismissSaveFailure}
          />
        )}
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

  return (
    <div className={s.desktop}>
      {navOn && (
        <NavRail
          view={view}
          notes={notes}
          onNavigate={navigate}
          onSearch={() => setPaletteOpen(true)}
          onCreate={handleCreate}
          dark={resolveDark(themePref)}
          onToggleTheme={toggleTheme}
        />
      )}

      {view === "timeline" && listOn && (
        <ListColumn
          notes={visibleNotes}
          activeId={activeId}
          onOpenNote={openNote}
          onCreate={handleCreate}
        />
      )}

      <div className={s.mainCol}>
        <Viewbar
          desk={{
            navOn,
            listOn,
            readMode,
            locked,
            showList: view === "timeline",
            onToggleNav: () => setNavOn((v) => !v),
            onToggleList: () => setListOn((v) => !v),
            onToggleRead: () => setReadMode((v) => !v),
            onToggleLock: () => setLocked((v) => !v),
          }}
          dark={resolveDark(themePref)}
          onToggleTheme={toggleTheme}
          canDelete={active !== null}
          onDelete={() => {
            if (active) handleDelete(active.id);
          }}
          share={{
            onShareMd: shareMarkdown,
            onShareMdZip: shareMarkdownZip,
            onSharePdf: sharePdf,
            onSharePng: sharePng,
            onPrint: sharePrint,
          }}
        />
        <main className={s.main}>{mainContent}</main>
      </div>

      {undoDelete && (
        <UndoToast
          message="已删除这篇笔记"
          onAction={undoDeleteNote}
          onDismiss={dismissUndo}
        />
      )}
      {saveFailure && (
        <UndoToast
          message={`没存上：${saveFailure.reason}`}
          actionLabel="重试"
          onAction={retrySave}
          onDismiss={dismissSaveFailure}
        />
      )}
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
