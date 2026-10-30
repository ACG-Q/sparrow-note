import { describe, expect, it } from "vitest";
import { previewRects, type PreviewContext } from "./tablePreview";

/**
 * 3 行 × 3 列的合成网格：格子 100×20，从 (10, 50) 开始。
 * 用固定坐标算，断言能精确到像素。
 */
const CELL_W = 100;
const CELL_H = 20;
const ORIGIN_X = 10;
const ORIGIN_Y = 50;

const grid = (): PreviewContext => ({
  pos: { row: 1, col: 1 },
  rowCount: 3,
  colCount: 3,
  tableRect: { left: ORIGIN_X, top: ORIGIN_Y, width: CELL_W * 3, height: CELL_H * 3, kind: "on" },
  cellRect: (row, col) => ({
    left: ORIGIN_X + col * CELL_W,
    top: ORIGIN_Y + row * CELL_H,
    width: CELL_W,
    height: CELL_H,
    kind: "on" as const,
  }),
});

describe("previewRects：单一范围", () => {
  it("本行 → 一个框，横跨整行", () => {
    const [rect, ...rest] = previewRects({ kind: "row" }, grid());
    expect(rest).toHaveLength(0);
    expect(rect).toMatchObject({
      left: ORIGIN_X,
      top: ORIGIN_Y + CELL_H,
      width: CELL_W * 3,
      height: CELL_H,
      kind: "on",
    });
  });

  it("本列 → 一个框，竖跨整列", () => {
    const [rect] = previewRects({ kind: "col" }, grid());
    expect(rect).toMatchObject({
      left: ORIGIN_X + CELL_W,
      top: ORIGIN_Y,
      width: CELL_W,
      height: CELL_H * 3,
    });
  });

  it("本格 → 只框当前格", () => {
    const [rect] = previewRects({ kind: "cell" }, grid());
    expect(rect).toMatchObject({ left: ORIGIN_X + CELL_W, top: ORIGIN_Y + CELL_H, width: CELL_W, height: CELL_H });
  });

  it("整表 → 框住整张表", () => {
    const [rect] = previewRects({ kind: "table" }, grid());
    expect(rect).toMatchObject({ left: ORIGIN_X, top: ORIGIN_Y, width: CELL_W * 3, height: CELL_H * 3 });
  });
});

describe("previewRects：移动", () => {
  it("本行上移 → 两个框：当前行(实线) + 上一行(落点)", () => {
    const rects = previewRects({ kind: "move-row", dir: -1 }, grid());
    expect(rects).toHaveLength(2);
    expect(rects[0]).toMatchObject({ top: ORIGIN_Y + CELL_H, kind: "on" });
    expect(rects[1]).toMatchObject({ top: ORIGIN_Y, kind: "target" });
  });

  it("第一行再上移 → 只有当前行，没有落点", () => {
    const ctx = { ...grid(), pos: { row: 0, col: 1 } };
    const rects = previewRects({ kind: "move-row", dir: -1 }, ctx);
    expect(rects).toHaveLength(1);
    expect(rects[0].kind).toBe("on");
  });

  it("本列右移 → 两个框：当前列 + 右侧落点", () => {
    const rects = previewRects({ kind: "move-col", dir: 1 }, grid());
    expect(rects).toHaveLength(2);
    expect(rects[0]).toMatchObject({ left: ORIGIN_X + CELL_W, kind: "on" });
    expect(rects[1]).toMatchObject({ left: ORIGIN_X + CELL_W * 2, kind: "target" });
  });

  it("最后一列再右移 → 只有当前列", () => {
    const ctx = { ...grid(), pos: { row: 1, col: 2 } };
    const rects = previewRects({ kind: "move-col", dir: 1 }, ctx);
    expect(rects).toHaveLength(1);
  });
});

describe("previewRects：合并单元格", () => {
  it("被跨行占住的格子返回 null 时，整行外接框仍按存在的格算", () => {
    const ctx: PreviewContext = {
      ...grid(),
      pos: { row: 1, col: 1 },
      // 模拟第二行第一列被上方 rowspan 吃掉
      cellRect: (row, col) => {
        if (row === 1 && col === 0) return null;
        return {
          left: ORIGIN_X + col * CELL_W,
          top: ORIGIN_Y + row * CELL_H,
          width: CELL_W,
          height: CELL_H,
          kind: "on" as const,
        };
      },
    };
    const [rect] = previewRects({ kind: "row" }, ctx);
    expect(rect.left).toBe(ORIGIN_X + CELL_W);
    expect(rect.width).toBe(CELL_W * 2);
  });
});
