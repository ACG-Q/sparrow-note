// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { NoteDoc } from "./notes";
import { idbBackend } from "./idb";

/**
 * IndexedDB 后端用 fake-indexeddb 真跑一遍（不是 mock）：
 * 建库、写、读、删、清空——这几条是数据安全的根，值得用真实现验证。
 */
const note = (id: string, title = "标题"): NoteDoc => ({
  id,
  title,
  date: "2026-10-30",
  createdAt: 1,
  updatedAt: 1,
  blocks: [
    {
      id: "b1",
      type: "paragraph",
      props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [{ type: "text", text: "正文", styles: {} }],
      children: [],
    },
  ] as never,
});

beforeEach(async () => {
  await idbBackend.clearAllNotes();
});

describe("idbBackend（真 IndexedDB）", () => {
  it("空库返回空数组", async () => {
    expect(await idbBackend.listNotes()).toEqual([]);
  });

  it("写入后能读出来，字段完整", async () => {
    await idbBackend.putNote(note("a", "秋日骑行"));
    const all = await idbBackend.listNotes();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("秋日骑行");
    expect(Array.isArray(all[0].blocks)).toBe(true);
  });

  it("同 id 再写是覆盖（upsert），不会出现两条", async () => {
    await idbBackend.putNote(note("a", "第一版"));
    await idbBackend.putNote(note("a", "第二版"));
    const all = await idbBackend.listNotes();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("第二版");
  });

  it("按 id 删除只删那一条", async () => {
    await idbBackend.putNote(note("a"));
    await idbBackend.putNote(note("b"));
    await idbBackend.deleteNote("a");
    const all = await idbBackend.listNotes();
    expect(all.map((n) => n.id)).toEqual(["b"]);
  });

  it("删除不存在的 id 不抛错", async () => {
    await expect(idbBackend.deleteNote("不存在")).resolves.toBeUndefined();
  });

  it("清空后回到空库", async () => {
    await idbBackend.putNote(note("a"));
    await idbBackend.clearAllNotes();
    expect(await idbBackend.listNotes()).toEqual([]);
  });

  it("写入带复杂块（表格/清单）的笔记也能原样读回", async () => {
    const rich: NoteDoc = {
      ...note("rich"),
      blocks: [
        {
          id: "st",
          type: "sparrowTable",
          props: { data: JSON.stringify({ headerRows: 1, headerCols: 0, rows: [] }) },
          content: undefined,
          children: [],
        },
      ] as never,
    };
    await idbBackend.putNote(rich);
    const all = await idbBackend.listNotes();
    expect(all[0].blocks[0].type).toBe("sparrowTable");
  });
});
