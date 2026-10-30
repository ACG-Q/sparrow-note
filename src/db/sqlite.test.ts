import { describe, expect, it } from "vitest";
import { getCorruptRowCount, rowToNote } from "./sqlite";

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "n1",
  title: "标题",
  date: "2026-10-20",
  created_at: 1,
  updated_at: 2,
  blocks: JSON.stringify([{ id: "b1", type: "paragraph", props: {}, content: [], children: [] }]),
  ...over,
});

describe("rowToNote", () => {
  it("正常行转成 NoteDoc", () => {
    const note = rowToNote(row() as never);
    expect(note).toMatchObject({ id: "n1", title: "标题", date: "2026-10-20" });
    expect(Array.isArray(note?.blocks)).toBe(true);
  });

  it("blocks 是坏 JSON → 跳过并返回 null", () => {
    expect(rowToNote(row({ blocks: "{不是 JSON" }) as never)).toBeNull();
  });

  it("blocks 是合法 JSON 但不是数组 → 也跳过", () => {
    expect(rowToNote(row({ blocks: '{"a":1}' }) as never)).toBeNull();
  });

  it("坏行会计数", () => {
    // 注意：计数是模块级状态，这里只断言「至少 +1」
    const before = getCorruptRowCount();
    rowToNote(row({ blocks: "坏" }) as never);
    expect(getCorruptRowCount()).toBeGreaterThan(before);
  });
});
