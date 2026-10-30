import { describe, expect, it } from "vitest";
import { isTableContent, mergeTableContents, rowWidth, withHeaders, type TableContent } from "./tableMerge";

const cell = (text = "", props: Record<string, unknown> = {}) => ({
  type: "tableCell",
  content: text ? [{ type: "text", text, styles: {} }] : [],
  props,
});

const table = (rows: string[][], extra: Partial<TableContent> = {}): TableContent => ({
  type: "tableContent",
  rows: rows.map((cells) => ({ cells: cells.map((t) => cell(t)) })),
  ...extra,
});

const texts = (content: TableContent) =>
  content.rows.map((r) =>
    r.cells.map((c) =>
      (c.content as { text?: string }[]).map((x) => x.text ?? "").join(""),
    ).join("|"),
  );

describe("表格内容识别", () => {
  it("识别表格内容", () => {
    expect(isTableContent(table([["a"]]))).toBe(true);
    expect(isTableContent({ type: "paragraph" })).toBe(false);
    expect(isTableContent(null)).toBe(false);
    expect(isTableContent({ type: "tableContent", rows: "x" })).toBe(false);
  });
});

describe("行宽计算", () => {
  it("把 colspan 算进去", () => {
    expect(rowWidth({ cells: [cell(), cell()] })).toBe(2);
    expect(rowWidth({ cells: [cell("", { colspan: 3 }), cell()] })).toBe(4);
  });
});

describe("多表合并", () => {
  it("按顺序拼接行", () => {
    const merged = mergeTableContents([table([["列", "数量"], ["甲", "1"]]), table([["乙", "2"], ["丙", "3"]])]);
    expect(texts(merged)).toEqual(["列|数量", "甲|1", "乙|2", "丙|3"]);
  });

  it("列数不同时补空格到最大宽度", () => {
    const merged = mergeTableContents([table([["a", "b", "c"]]), table([["d"]])]);
    expect(texts(merged)).toEqual(["a|b|c", "d||"]);
    expect(merged.rows[1].cells).toHaveLength(3);
  });

  it("第一张表的表头设置带过来", () => {
    const merged = mergeTableContents([table([["h"]], { headerRows: 1, headerCols: 2 }), table([["x"]], { headerRows: 3 })]);
    expect(merged.headerRows).toBe(1);
    expect(merged.headerCols).toBe(2);
  });

  it("空输入不炸", () => {
    expect(mergeTableContents([]).rows).toEqual([]);
  });

  it("合并单元格原样保留", () => {
    const merged = mergeTableContents([
      table([["a", "b"]]),
      { type: "tableContent", rows: [{ cells: [cell("m", { colspan: 2 })] }] },
    ]);
    expect(merged.rows[1].cells[0].props.colspan).toBe(2);
    // colspan=2 的单元格本身覆盖两列，不需要补格
    expect(merged.rows[1].cells).toHaveLength(1);
    expect(rowWidth(merged.rows[1])).toBe(2);
  });
});

describe("批量表头", () => {
  it("设置与取消", () => {
    const base = table([["h"]]);
    expect(withHeaders(base, { headerRows: 1 }).headerRows).toBe(1);
    expect(withHeaders(withHeaders(base, { headerRows: 1 }), { headerRows: undefined }).headerRows).toBeUndefined();
    expect(withHeaders(base, { headerCols: 1 }).headerCols).toBe(1);
    // 不动的字段不受影响
    const both = withHeaders(base, { headerRows: 1, headerCols: 1 });
    expect(withHeaders(both, { headerRows: undefined }).headerCols).toBe(1);
  });
});
