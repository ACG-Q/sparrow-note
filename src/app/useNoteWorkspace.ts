import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteNote, listNotes, putNote, type NoteDoc } from "../db/notes";
import { noteMatchesQuery } from "../lib/aggregate";
import { setChecklistItem, type ChecklistEntry } from "../lib/checklist";
import { noteHash, parseNoteHash } from "../lib/nav";
import { sortByDateDesc } from "../lib/timeline";
import { writeWithRetry, type FailedSave } from "./saveGuard";
import { insertIfMissing, nextActiveAfterDelete, patchNote, replaceNote } from "./noteOps";

/**
 * 笔记工作区：数据 + 增删改 + 打开/关闭 + 派生列表。
 *
 * 从 App.tsx 搬出来的（原样搬迁，未改逻辑）。只处理「笔记」这一域，
 * 不碰视图与面板——那些由调用方在外层组合（见 App.tsx 的 openNote / navigate 包装）。
 */

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function newNote(): NoteDoc {
  return {
    id: crypto.randomUUID(),
    title: "",
    date: today(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    blocks: [],
  };
}

export type NoteWorkspace = {
  notes: NoteDoc[];
  activeId: string | null;
  active: NoteDoc | null;
  loaded: boolean;
  loadError: string;
  /** 读库失败后重试用 */
  loadNotes: () => Promise<void>;
  reloadNotes: () => void;
  /** 只做「记住当前笔记」，视图/面板由调用方处理 */
  selectNote: (id: string) => void;
  clearSelection: () => void;
  createNote: (onCreated: (id: string) => void) => void;
  deleteNote: (id: string, onFallback: (id: string | null) => void) => void;
  /** 写库两次都失败时留在这里，等用户点重试 */
  saveFailure: FailedSave | null;
  retrySave: () => void;
  dismissSaveFailure: () => void;
  undoDelete: { note: NoteDoc; wasActive: boolean } | null;
  undoDeleteNote: (onRestored: (id: string) => void) => void;
  dismissUndo: () => void;
  toggleChecklistItem: (entry: ChecklistEntry, markSave: (ok: boolean) => void) => void;
  changeTitle: (title: string, markSave: (ok: boolean) => void) => void;
  /** 改其它字段（例如日期）：改完立刻落盘 */
  updateNote: (patch: Partial<Pick<NoteDoc, "date" | "title">>, markSave: (ok: boolean) => void) => void;
  changeBlocks: (blocks: NoteDoc["blocks"], markSave: (ok: boolean) => void) => void;
  /** 按搜索词 + 日期筛选后的列表 */
  visibleNotes: (query: string, dateFilter: string) => NoteDoc[];
  sorted: NoteDoc[];
  prevNote: NoteDoc | null;
  nextNote: NoteDoc | null;
  /** 第几篇（从最新算） */
  noteNumber: number;
};

export function useNoteWorkspace(): NoteWorkspace {
  const [notes, setNotes] = useState<NoteDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string>("");
  const [undoDelete, setUndoDelete] = useState<{ note: NoteDoc; wasActive: boolean } | null>(null);
  const [saveFailure, setSaveFailure] = useState<FailedSave | null>(null);

  /** 统一的写库入口：失败自动重试一次，两次都失败就登记下来给 UI */
  const persist = useCallback(
    (note: NoteDoc, markSave: (ok: boolean) => void) => {
      void writeWithRetry(
        async (n) => {
          await putNote(n);
        },
        note,
      ).then((res) => {
        if (res.ok) {
          markSave(true);
          setSaveFailure(null);
          return;
        }
        markSave(false);
        setSaveFailure({ note, attempts: res.attempts, reason: res.reason });
      });
    },
    [],
  );

  const retrySave = useCallback(() => {
    const pending = saveFailure;
    if (!pending) return;
    void writeWithRetry(
      async (n) => {
        await putNote(n);
      },
      pending.note,
    ).then((res) => {
      if (res.ok) setSaveFailure(null);
      else setSaveFailure({ note: pending.note, attempts: res.attempts, reason: res.reason });
    });
  }, [saveFailure]);

  const dismissSaveFailure = useCallback(() => setSaveFailure(null), []);

  const undoTimer = useRef<number | null>(null);
  const pushedRef = useRef(false);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const loadNotes = useCallback(() => {
    setLoadError("");
    return listNotes().then(
      (all) => {
        setNotes(all);
        const fromHash = parseNoteHash(window.location.hash);
        setActiveId(fromHash && all.some((n) => n.id === fromHash) ? fromHash : null);
        setLoaded(true);
      },
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err ?? "未知错误");
        console.error("[sparrow] 读取笔记失败：", err);
        setLoadError(msg);
        setLoaded(true);
      },
    );
  }, []);

  const bootRef = useRef(false);
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    void loadNotes();
  }, [loadNotes]);

  // 浏览器前进/后退：hash 变了就同步当前笔记
  useEffect(() => {
    const sync = () => {
      const id = parseNoteHash(window.location.hash);
      const valid = id !== null && notesRef.current.some((n) => n.id === id);
      if (id !== null && !valid) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
      setActiveId(valid ? id : null);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const active = useMemo(
    () => (activeId ? notes.find((n) => n.id === activeId) ?? null : null),
    [activeId, notes],
  );
  const sorted = useMemo(() => sortByDateDesc(notes), [notes]);
  const activeIndex = useMemo(
    () => (activeId ? sorted.findIndex((n) => n.id === activeId) : -1),
    [sorted, activeId],
  );

  const selectNote = useCallback((id: string) => {
    const target = noteHash(id);
    if (window.location.hash !== target) {
      window.history.pushState(null, "", target);
      pushedRef.current = true;
    }
    setActiveId(id);
  }, []);

  const clearSelection = useCallback(() => {
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

  const createNote = useCallback((onCreated: (id: string) => void) => {
    const note = newNote();
    putNote(note).then(() => {
      setNotes((prev) => [note, ...prev]);
      onCreated(note.id);
    });
  }, []);

  /**
   * 删除笔记：先删 + 5 秒撤销（可逆操作，不做打断式确认）。
   * 删的是当前笔记时，由调用方决定接下来选哪篇（onFallback）。
   */
  const removeNote = useCallback(
    (id: string, onFallback: (id: string | null) => void) => {
      const target = notesRef.current.find((n) => n.id === id);
      if (!target) return;
      deleteNote(id).then(() => {
        const next = notesRef.current.filter((n) => n.id !== id);
        setNotes(next);
        setUndoDelete({ note: target, wasActive: activeId === id });
        if (undoTimer.current) window.clearTimeout(undoTimer.current);
        undoTimer.current = window.setTimeout(() => {
          setUndoDelete(null);
          undoTimer.current = null;
        }, 5000);
        onFallback(nextActiveAfterDelete(next, id, activeId));
      });
    },
    [activeId],
  );

  const undoDeleteNote = useCallback(
    (onRestored: (id: string) => void) => {
      const pending = undoDelete;
      if (!pending) return;
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
      undoTimer.current = null;
      setUndoDelete(null);
      const { note, wasActive } = pending;
      putNote(note).then(() => {
        setNotes((prev) => insertIfMissing(prev, note));
        if (wasActive) onRestored(note.id);
      });
    },
    [undoDelete],
  );

  const dismissUndo = useCallback(() => {
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndoDelete(null);
  }, []);

  const toggleChecklistItem = useCallback(
    (entry: ChecklistEntry, markSave: (ok: boolean) => void) => {
      const note = notesRef.current.find((n) => n.id === entry.noteId);
      if (!note) return;
      const updated = setChecklistItem(note, entry.blockId, entry.itemIndex);
      if (!updated) return;
      persist(updated, markSave);
      setNotes((prev) => replaceNote(prev, updated));
    },
    [persist],
  );

  const changeTitle = useCallback(
    (title: string, markSave: (ok: boolean) => void) => {
      if (!active) return;
      const updated = { ...active, title, updatedAt: Date.now() };
      persist(updated, markSave);
      setNotes((prev) => replaceNote(prev, updated));
    },
    [active, persist],
  );

  const changeBlocks = useCallback(
    (blocks: NoteDoc["blocks"], markSave: (ok: boolean) => void) => {
      if (!active) return;
      const updated = { ...active, blocks, updatedAt: Date.now() };
      persist(updated, markSave);
      setNotes((prev) => replaceNote(prev, updated));
    },
    [active, persist],
  );

  const updateNote = useCallback(
    (patch: Partial<Pick<NoteDoc, "date" | "title">>, markSave: (ok: boolean) => void) => {
      if (!active) return;
      const updated = patchNote(active, patch);
      persist(updated, markSave);
      setNotes((prev) => replaceNote(prev, updated));
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

  const visibleNotes = useCallback(
    (query: string, dateFilter: string) =>
      notes.filter((n) => noteMatchesQuery(n, query) && (!dateFilter || n.date === dateFilter)),
    [notes],
  );

  return {
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
    undoDeleteNote,
    dismissUndo,
    toggleChecklistItem,
    changeTitle,
    changeBlocks,
    updateNote,
    visibleNotes,
    sorted,
    prevNote: activeIndex > 0 ? sorted[activeIndex - 1] : null,
    nextNote: activeIndex >= 0 && activeIndex < sorted.length - 1 ? sorted[activeIndex + 1] : null,
    noteNumber: activeIndex >= 0 ? sorted.length - activeIndex : 0,
  };
}
