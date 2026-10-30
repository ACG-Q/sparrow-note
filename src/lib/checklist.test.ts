import { describe, expect, it } from "vitest";
import type { NoteDoc } from "../db/notes";
import {
  checklistCounts,
  collectChecklist,
  parseChecklistItems,
  setChecklistItem,
} from "./checklist";

const note = (id: string, title: string, date: string, blocks: unknown[]): NoteDoc =>
  ({ id, title, date, createdAt: 0, updatedAt: 0, blocks }) as unknown as NoteDoc;

const listBlock = (id: string, items: { t: string; d: boolean }[]) => ({
  id,
  type: "checklist",
  props: { items: JSON.stringify(items) },
  children: [],
});

describe("parseChecklistItems", () => {
  it("正常解析", () => {
    expect(parseChecklistItems('[{"t":"a","d":true}]')).toEqual([{ t: "a", d: true }]);
  });
  it("坏数据返回空数组", () => {
    expect(parseChecklistItems("不是 JSON")).toEqual([]);
    expect(parseChecklistItems(undefined)).toEqual([]);
    expect(parseChecklistItems('{"t":"a"}')).toEqual([]);
  });
  it("缺 d 当未完成", () => {
    expect(parseChecklistItems('[{"t":"a"}]')).toEqual([{ t: "a", d: false }]);
  });
});

describe("collectChecklist", () => {
  it("跨笔记摊平，带定位信息", () => {
    const notes = [
      note("n1", "第一篇", "2026-10-20", [listBlock("b1", [{ t: "买菜", d: false }, { t: "跑步", d: true }])]),
      note("n2", "第二篇", "2026-10-18", [listBlock("b2", [{ t: "交房租", d: false }])]),
    ];
    const rows = collectChecklist(notes);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ noteId: "n1", blockId: "b1", itemIndex: 0, text: "买菜", done: false });
    expect(rows[1]).toMatchObject({ itemIndex: 1, text: "跑步", done: true });
    expect(rows[2]).toMatchObject({ noteId: "n2", text: "交房租" });
  });

  it("跳过空文本项", () => {
    const rows = collectChecklist([note("n", "t", "2026-10-20", [listBlock("b", [{ t: "  ", d: false }, { t: "有效", d: false }])])]);
    expect(rows.map((r) => r.text)).toEqual(["有效"]);
    // 空项被跳过，但它的下标仍然是 1
    expect(rows[0].itemIndex).toBe(1);
  });

  it("嵌在子块里的清单也能找到", () => {
    const nested = {
      id: "p",
      type: "paragraph",
      props: {},
      children: [listBlock("deep", [{ t: "深层项", d: false }])],
    };
    const rows = collectChecklist([note("n", "t", "2026-10-20", [nested])]);
    expect(rows[0]).toMatchObject({ blockId: "deep", text: "深层项" });
  });

  it("计数", () => {
    const rows = collectChecklist([
      note("n", "t", "2026-10-20", [listBlock("b", [{ t: "a", d: false }, { t: "b", d: true }, { t: "c", d: false }])]),
    ]);
    expect(checklistCounts(rows)).toEqual({ open: 2, done: 1 });
  });
});

describe("setChecklistItem", () => {
  const base = note("n", "t", "2026-10-20", [
    listBlock("b1", [{ t: "a", d: false }, { t: "b", d: false }]),
  ]);

  it("翻转某一条，不改原对象", () => {
    const next = setChecklistItem(base, "b1", 1);
    expect(next).not.toBeNull();
    expect(parseChecklistItems((next!.blocks[0] as { props: { items: string } }).props.items)).toEqual([
      { t: "a", d: false },
      { t: "b", d: true },
    ]);
    // 原对象没动
    expect(parseChecklistItems((base.blocks[0] as { props: { items: string } }).props.items)).toEqual([
      { t: "a", d: false },
      { t: "b", d: false },
    ]);
  });

  it("可以置位而不是翻转", () => {
    const next = setChecklistItem(base, "b1", 0, true);
    expect(parseChecklistItems((next!.blocks[0] as { props: { items: string } }).props.items)[0].d).toBe(true);
  });

  it("找不到块 / 下标越界 / 值没变化 → null", () => {
    expect(setChecklistItem(base, "不存在", 0)).toBeNull();
    expect(setChecklistItem(base, "b1", 9)).toBeNull();
    expect(setChecklistItem(base, "b1", 0, false)).toBeNull();
  });

  it("改子块里的清单", () => {
    const nested = note("n", "t", "2026-10-20", [
      { id: "p", type: "paragraph", props: {}, children: [listBlock("deep", [{ t: "深层", d: false }])] },
    ]);
    const next = setChecklistItem(nested, "deep", 0);
    expect(next).not.toBeNull();
    const deep = (next!.blocks[0] as { children: { props: { items: string } }[] }).children[0];
    expect(parseChecklistItems(deep.props.items)[0].d).toBe(true);
  });
});
