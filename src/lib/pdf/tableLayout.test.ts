import { describe, expect, it } from "vitest";
import { layoutTable, rowTops, type CellSpan } from "./tableLayout";

/** 每格高度固定，方便断言行高分配 */
const fixed = (h: number) => () => h;
const span = (colspan = 1, rowspan = 1): CellSpan => ({ colspan, rowspan });

const base = {
  totalCols: 3,
  headerRows: 1,
  headerCols: 0,
  rowMinHeight: 12,
  cellHeight: fixed(30),
};

describe("layoutTable 落位", () => {
  it("普通 2×3 表格：每格占一格", () => {
    const { cells } = layoutTable({
      ...base,
      rows: [[span(), span(), span()], [span(), span(), span()]],
    });
    expect(cells).toHaveLength(6);
    expect(cells[0]).toMatchObject({ row: 0, col: 0, rowSpan: 1, colSpan: 1 });
    expect(cells[4]).toMatchObject({ row: 1, col: 1 });
  });

  it("colspan 会占掉后面的格子，后续格右移", () => {
    const { cells } = layoutTable({
      ...base,
      rows: [[span(2), span()], [span(), span(), span()]],
    });
    expect(cells[0]).toMatchObject({ row: 0, col: 0, colSpan: 2 });
    expect(cells[1]).toMatchObject({ row: 0, col: 2 });
  });

  it("rowspan 会让下一行跳过被占的列", () => {
    const { cells } = layoutTable({
      ...base,
      rows: [[span(1, 2), span(), span()], [span(), span()]],
    });
    // 第二行只剩两个格，落在 col 1 / col 2（col 0 被上一行的跨行格占着）
    const second = cells.filter((c) => c.row === 1);
    expect(second.map((c) => c.col)).toEqual([1, 2]);
  });

  it("跨度超过边界会被夹紧", () => {
    const { cells } = layoutTable({
      ...base,
      rows: [[span(9, 9)]],
    });
    expect(cells[0].colSpan).toBe(3);
    expect(cells[0].rowSpan).toBe(1);
  });

  it("表头标记：表头行或表头列都算表头", () => {
    const { cells } = layoutTable({
      ...base,
      totalCols: 2,
      headerRows: 1,
      headerCols: 1,
      rows: [[span(), span()], [span(), span()]],
    });
    expect(cells[0].head).toBe(true); // 表头行
    expect(cells[2].head).toBe(true); // 表头列（第一列）
    expect(cells[3].head).toBe(false);
  });
});

describe("layoutTable 行高", () => {
  it("单行格把所在行撑到内容高度（不小于最小值）", () => {
    const { rowHeights } = layoutTable({
      ...base,
      rows: [[span()], [span()]],
      cellHeight: (c) => (c.row === 1 ? 90 : 20),
    });
    expect(rowHeights[0]).toBe(20); // max(rowMinHeight 12, 内容 20)
    expect(rowHeights[1]).toBe(90);
  });

  it("跨行格不够高时，把差值补到它跨的最后一行", () => {
    const { rowHeights, totalHeight } = layoutTable({
      ...base,
      rows: [[span(1, 2)], [span()]],
      cellHeight: (c) => (c.rowSpan === 2 ? 100 : 20),
      rowMinHeight: 12,
    });
    // 第一行 12 + 第二行 12 = 24 < 100，需要补 76 到第二行
    expect(rowHeights[0]).toBe(12);
    expect(rowHeights[1]).toBe(88);
    expect(totalHeight).toBe(100);
  });

  it("跨行格够高时不额外撑行", () => {
    const { rowHeights, totalHeight } = layoutTable({
      ...base,
      rows: [[span(1, 2)], [span()]],
      cellHeight: (c) => (c.rowSpan === 2 ? 30 : 20),
      rowMinHeight: 12,
    });
    // 第一行只有跨行格（不参与单行撑高）→ 12；第二行被单行格撑到 20；合计 32 ≥ 30
    expect(rowHeights).toEqual([12, 20]);
    expect(totalHeight).toBe(32);
  });
});

describe("rowTops", () => {
  it("从顶部往下递减，前缀与行高对应", () => {
    expect(rowTops([40, 20, 10], 100)).toEqual([100, 60, 40]);
  });
});
