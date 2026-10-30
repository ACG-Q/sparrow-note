import { describe, expect, it } from "vitest";
import { headerRowCount, isHeaderCell, readTable } from "./tableContent";

const cell = (text: string) => ({ content: [{ type: "text", text, styles: {} }] });
const table = (rows: string[][], patch: Record<string, unknown> = {}) => ({
  type: "tableContent",
  rows: rows.map((r) => ({ cells: r.map((t) => cell(t)) })),
  ...patch,
});

describe("readTable", () => {
  it("空内容 / 没有行 → null", () => {
    expect(readTable(undefined)).toBeNull();
    expect(readTable(null)).toBeNull();
    expect(readTable({})).toBeNull();
    expect(readTable({ rows: [] })).toBeNull();
  });

  it("列数按最长一行算", () => {
    const t = readTable({
      rows: [{ cells: [cell("a"), cell("b")] }, { cells: [cell("c")] }],
    });
    expect(t?.cols).toBe(2);
    expect(t?.rows).toHaveLength(2);
  });

  it("headerRows 夹到 [0, 行数]", () => {
    const content = table([["h1"], ["h2"], ["b"]], { headerRows: 9 });
    expect(readTable(content)?.headerRows).toBe(3);
    expect(readTable({ ...content, headerRows: -2 })?.headerRows).toBe(0);
    expect(readTable({ ...content, headerRows: 2.7 })?.headerRows).toBe(2);
  });

  it("headerCols 夹到 [0, 列数]", () => {
    const content = table([["a", "b", "c"], ["d", "e", "f"]], { headerCols: 5 });
    expect(readTable(content)?.headerCols).toBe(3);
  });

  it("缺省 header 全是 0", () => {
    const t = readTable(table([["a", "b"]]));
    expect(t?.headerRows).toBe(0);
    expect(t?.headerCols).toBe(0);
  });

  it("数字字符串按数字算，真非数字当 0", () => {
    // 存档里出现过字符串形式，这里宽松接受
    const twoRows = [{ cells: [cell("a")] }, { cells: [cell("b")] }];
    expect(readTable({ rows: twoRows, headerRows: "2" as unknown })?.headerRows).toBe(2);
    expect(readTable({ rows: twoRows, headerRows: "abc" as unknown })?.headerRows).toBe(0);
  });
});

describe("isHeaderCell", () => {
  it("表头行与表头列的并集", () => {
    const t = readTable(table([["a", "b", "c"], ["d", "e", "f"], ["g", "h", "i"]], {
      headerRows: 1,
      headerCols: 1,
    }))!;
    // 第一行全是表头
    expect([0, 1, 2].map((c) => isHeaderCell(t, 0, c))).toEqual([true, true, true]);
    // 第一列第 2、3 行也是表头
    expect([1, 2].map((r) => isHeaderCell(t, r, 0))).toEqual([true, true]);
    // 其余不是
    expect(isHeaderCell(t, 1, 1)).toBe(false);
    expect(isHeaderCell(t, 2, 2)).toBe(false);
  });

  it("两行表头时前两行都是表头", () => {
    const t = readTable(table([["a"], ["b"], ["c"]], { headerRows: 2 }))!;
    expect([0, 1, 2].map((r) => isHeaderCell(t, r, 0))).toEqual([true, true, false]);
  });
});

describe("headerRowCount", () => {
  it("返回夹紧后的行数", () => {
    expect(headerRowCount(table([["a"], ["b"]], { headerRows: 2 }))).toBe(2);
    expect(headerRowCount(table([["a"], ["b"]], { headerRows: 5 }))).toBe(2);
    expect(headerRowCount(null)).toBe(0);
  });
});
