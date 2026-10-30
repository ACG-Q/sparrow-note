/**
 * 自研表格的 PDF 排版计算（纯函数，不碰 canvas / pdf-lib）。
 *
 * 为什么要单独抽出来：跨行跨列的落位与行高分配很容易算错，而以前这段逻辑埋在
 * `buildNotePdf` 的闭包里，只能靠导出一份 PDF 肉眼看。抽成纯函数后可以直接断言：
 * 谁占哪一格、合并格有没有内部线、跨行格撑高后行高分配对不对。
 */

export type CellSpan = { colspan: number; rowspan: number };

/** 落位后的单元格：row/col 是左上角格子，跨度已按表格边界夹紧 */
export type PlacedCell = {
  /** 在输入数组里的下标，方便调用方回查内容 */
  index: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  /** 表头格：在表头行里，或落在表头列里 */
  head: boolean;
};

export type LayoutParams = {
  /** 每行的单元格跨度（只看结构，不看内容） */
  rows: CellSpan[][];
  totalCols: number;
  headerRows: number;
  headerCols: number;
  /** 单元格内容需要多高（含上下 padding）。接收落位信息，调用方自己折行算 */
  cellHeight: (cell: PlacedCell) => number;
  /** 一行的最小高度（空行也不会塌成 0） */
  rowMinHeight: number;
};

export type LayoutResult = {
  cells: PlacedCell[];
  rowHeights: number[];
  totalHeight: number;
};

/**
 * 计算落位与行高。
 *
 * 行高规则：
 * 1. 先按「单行格」把各自那一行撑到内容高度
 * 2. 再让「跨行格」检查它跨过的行加起来够不够；不够就把差值补到它跨的最后一行
 * 这样合并格一定放得下，且不会把整表高度算多。
 */
export function layoutTable(params: LayoutParams): LayoutResult {
  const { rows, totalCols, headerRows, headerCols, cellHeight, rowMinHeight } = params;
  const occupied: boolean[][] = rows.map(() => Array<boolean>(totalCols).fill(false));
  const cells: PlacedCell[] = [];
  let index = 0;

  rows.forEach((row, ri) => {
    let col = 0;
    for (const span of row) {
      // 跳过被上方跨行占住的位置
      while (col < totalCols && occupied[ri][col]) col += 1;
      if (col >= totalCols) break;
      const colSpan = Math.max(1, Math.min(span.colspan, totalCols - col));
      const rowSpan = Math.max(1, Math.min(span.rowspan, rows.length - ri));
      for (let r = ri; r < ri + rowSpan; r++) {
        for (let c = col; c < col + colSpan; c++) occupied[r][c] = true;
      }
      cells.push({
        index,
        row: ri,
        col,
        rowSpan,
        colSpan,
        head: ri < headerRows || col < headerCols,
      });
      index += 1;
      col += colSpan;
    }
  });

  const rowHeights = rows.map(() => rowMinHeight);
  for (const c of cells) {
    if (c.rowSpan !== 1) continue;
    rowHeights[c.row] = Math.max(rowHeights[c.row], cellHeight(c));
  }
  for (const c of cells) {
    if (c.rowSpan === 1) continue;
    const need = cellHeight(c);
    let have = 0;
    for (let r = c.row; r < c.row + c.rowSpan; r++) have += rowHeights[r];
    if (have < need) rowHeights[c.row + c.rowSpan - 1] += need - have;
  }

  return {
    cells,
    rowHeights,
    totalHeight: rowHeights.reduce((a, b) => a + b, 0),
  };
}

/** 从表格顶部开始，逐行的 y 坐标（首行 top 传入，往后递减） */
export function rowTops(rowHeights: number[], start: number): number[] {
  const tops: number[] = [];
  let cursor = start;
  for (const h of rowHeights) {
    tops.push(cursor);
    cursor -= h;
  }
  return tops;
}
