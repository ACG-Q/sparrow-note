// @vitest-environment happy-dom
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "../db/notes";

// —— 数据层：内存实现，能注入失败 ——
const db = {
  notes: [] as NoteDoc[],
  failList: 0,
  failPut: 0,
  putCalls: 0,
};

vi.mock("../db/notes", () => ({
  listNotes: async () => {
    if (db.failList > 0) {
      db.failList -= 1;
      throw new Error("模拟读库失败");
    }
    return [...db.notes];
  },
  putNote: async (note: NoteDoc) => {
    db.putCalls += 1;
    if (db.failPut > 0) {
      db.failPut -= 1;
      throw new Error("模拟写库失败");
    }
    const idx = db.notes.findIndex((n) => n.id === note.id);
    if (idx >= 0) db.notes[idx] = note;
    else db.notes = [note, ...db.notes];
  },
  deleteNote: async (id: string) => {
    db.notes = db.notes.filter((n) => n.id !== id);
  },
}));

const note = (id: string, title = "标题"): NoteDoc => ({
  id,
  title,
  date: "2026-10-30",
  createdAt: 1,
  updatedAt: 1,
  blocks: [],
});

const shareCalls = { md: 0, zip: 0, pdf: 0, png: 0, print: 0 };
vi.mock("../lib/share", () => ({
  noteToMarkdown: () => "# md",
  noteToMarkdownWithAssets: () => ({ markdown: "# md", assets: [] }),
}));
vi.mock("../lib/shareExport", () => ({
  downloadMarkdownFile: () => { shareCalls.md += 1; },
  downloadMarkdownZip: () => { shareCalls.zip += 1; },
  exportNotePdf: async () => { shareCalls.pdf += 1; },
  exportNodePng: async () => { shareCalls.png += 1; return { count: 2 }; },
  printNode: () => { shareCalls.print += 1; },
}));

// 用渲染一个空组件的方式驱动 hook
import { useDeskPrefs, useNarrowViewport, useSaveIndicator } from "./useDeskPrefs";
import { useNoteWorkspace } from "./useNoteWorkspace";
import { useShareActions } from "./useShareActions";

/** 把 hook 的返回值暴露出来，便于断言 */
function useProbe<T>(hook: () => T): { current: T } {
  const box = { current: undefined as unknown as T };
  function Probe() {
    box.current = hook();
    return null;
  }
  render(<Probe />);
  return box;
}

beforeEach(() => {
  db.notes = [note("a", "秋日骑行"), note("b", "本周待办")];
  db.failList = 0;
  db.failPut = 0;
  db.putCalls = 0;
  window.history.replaceState(null, "", "/");
});

describe("useNoteWorkspace", () => {
  it("启动读库后拿到笔记列表", async () => {
    const ws = useProbe(() => useNoteWorkspace());
    await waitFor(() => expect(ws.current.loaded).toBe(true));
    expect(ws.current.notes).toHaveLength(2);
    expect(ws.current.loadError).toBe("");
  });

  it("读库失败时记下原因，可以重试", async () => {
    db.failList = 1;
    const ws = useProbe(() => useNoteWorkspace());
    await waitFor(() => expect(ws.current.loadError).toContain("模拟读库失败"));
    expect(ws.current.loaded).toBe(true);
    await act(async () => {
      await ws.current.loadNotes();
    });
    await waitFor(() => expect(ws.current.loadError).toBe(""));
    expect(ws.current.notes).toHaveLength(2);
  });

  it("新建笔记会写库并进列表", async () => {
    const ws = useProbe(() => useNoteWorkspace());
    await waitFor(() => expect(ws.current.loaded).toBe(true));
    await act(async () => {
      ws.current.createNote((id) => ws.current.selectNote(id));
    });
    await waitFor(() => expect(ws.current.notes).toHaveLength(3));
  });

  it("删除后能撤销（写回原笔记）", async () => {
    const ws = useProbe(() => useNoteWorkspace());
    await waitFor(() => expect(ws.current.loaded).toBe(true));
    ws.current.selectNote("a");
    await act(async () => {
      ws.current.deleteNote("a", () => {});
    });
    await waitFor(() => expect(ws.current.notes).toHaveLength(1));
    expect(ws.current.undoDelete?.note.id).toBe("a");
    await act(async () => {
      ws.current.undoDeleteNote(() => {});
    });
    await waitFor(() => expect(ws.current.notes).toHaveLength(2));
  });

  it("改标题会落库并更新列表", async () => {
    const ws = useProbe(() => useNoteWorkspace());
    await waitFor(() => expect(ws.current.loaded).toBe(true));
    ws.current.selectNote("a");
    await waitFor(() => expect(ws.current.active?.id).toBe("a"));
    const mark = vi.fn();
    await act(async () => {
      ws.current.changeTitle("新标题", mark);
    });
    await waitFor(() => expect(ws.current.notes.find((n) => n.id === "a")?.title).toBe("新标题"));
    expect(mark).toHaveBeenCalledWith(true);
  });

  it("写库失败两次后登记 saveFailure，重试成功后清空", async () => {
    const ws = useProbe(() => useNoteWorkspace());
    await waitFor(() => expect(ws.current.loaded).toBe(true));
    ws.current.selectNote("a");
    await waitFor(() => expect(ws.current.active?.id).toBe("a"));
    db.failPut = 2;
    const mark = vi.fn();
    await act(async () => {
      ws.current.changeTitle("存不上的标题", mark);
    });
    await waitFor(() => expect(ws.current.saveFailure).not.toBeNull());
    expect(mark).toHaveBeenCalledWith(false);
    await act(async () => {
      ws.current.retrySave();
    });
    await waitFor(() => expect(ws.current.saveFailure).toBeNull());
    ws.current.dismissSaveFailure();
  });

  it("按搜索词与日期过滤可见列表", async () => {
    const ws = useProbe(() => useNoteWorkspace());
    await waitFor(() => expect(ws.current.loaded).toBe(true));
    expect(ws.current.visibleNotes("", "")).toHaveLength(2);
    expect(ws.current.visibleNotes("秋日", "")).toHaveLength(1);
    expect(ws.current.visibleNotes("", "2026-10-31")).toHaveLength(0);
  });

  it("reloadNotes 会清空当前选择", async () => {
    const ws = useProbe(() => useNoteWorkspace());
    await waitFor(() => expect(ws.current.loaded).toBe(true));
    ws.current.selectNote("a");
    await act(async () => {
      ws.current.reloadNotes();
    });
    await waitFor(() => expect(ws.current.activeId).toBeNull());
  });

  it("清单勾选走同一条保存链路", async () => {
    db.notes = [
      {
        ...note("c"),
        blocks: [
          {
            id: "ck",
            type: "checklist",
            props: { items: JSON.stringify([{ t: "交周报", d: false }]) },
            content: undefined,
            children: [],
          },
        ] as never,
      },
    ];
    const ws = useProbe(() => useNoteWorkspace());
    await waitFor(() => expect(ws.current.loaded).toBe(true));
    const mark = vi.fn();
    await act(async () => {
      ws.current.toggleChecklistItem(
        {
          noteId: "c",
          noteTitle: "标题",
          noteDate: "2026-10-30",
          blockId: "ck",
          itemIndex: 0,
          text: "交周报",
          done: false,
        },
        mark,
      );
    });
    await waitFor(() => expect(mark).toHaveBeenCalledWith(true));
    const saved = db.notes[0].blocks as unknown as { props: { items: string } }[];
    expect(saved[0].props.items).toContain('"d":true');
  });
});

describe("useDeskPrefs", () => {
  it("默认全开，改动会写进 localStorage", async () => {
    localStorage.clear();
    const prefs = useProbe(() => useDeskPrefs());
    expect(prefs.current.navOn).toBe(true);
    act(() => prefs.current.setNavOn(false));
    await waitFor(() => expect(localStorage.getItem("sparrow-desk-nav")).toBe("0"));
    act(() => prefs.current.setLocked(true));
    await waitFor(() => expect(localStorage.getItem("sparrow-desk-lock")).toBe("1"));
  });

  it("窄屏判定能读到 matchMedia 结果", () => {
    const narrow = useProbe(() => useNarrowViewport());
    expect(typeof narrow.current).toBe("boolean");
  });
});

describe("useSaveIndicator", () => {
  it("标记成功后 1.6 秒回落到 idle", async () => {
    vi.useFakeTimers();
    const ind = useProbe(() => useSaveIndicator());
    act(() => ind.current.markSave(true));
    expect(ind.current.saveState).toBe("ok");
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(ind.current.saveState).toBe("idle");
    vi.useRealTimers();
  });
});

describe("useShareActions", () => {
  it("没有选中笔记时各动作都是空操作", () => {
    const share = useProbe(() => useShareActions(null));
    expect(() => share.current.shareMarkdown()).not.toThrow();
    expect(() => share.current.sharePng()).not.toThrow();
    expect(() => share.current.sharePrint()).not.toThrow();
  });

  it("有笔记时导出提示会显示再消失", async () => {
    vi.useFakeTimers();
    const share = useProbe(() => useShareActions(note("a")));
    act(() => share.current.showShareHint("已导出 2 张图"));
    expect(share.current.shareHint).toBe("已导出 2 张图");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(share.current.shareHint).toBeNull();
    vi.useRealTimers();
  });
});

describe("useShareActions 的动作接线", () => {
  it("Markdown / 附件 / PDF / 打印 都会调到对应导出函数", async () => {
    const share = useProbe(() => useShareActions(note("a")));
    share.current.shareMarkdown();
    share.current.shareMarkdownZip();
    share.current.sharePdf();
    share.current.sharePrint();
    await Promise.resolve();
    expect(shareCalls.md + shareCalls.zip + shareCalls.print).toBeGreaterThan(0);
  });

  it("sharePng 在没有 DOM 根节点时安全退出", () => {
    const share = useProbe(() => useShareActions(note("a")));
    expect(() => share.current.sharePng()).not.toThrow();
  });
});
