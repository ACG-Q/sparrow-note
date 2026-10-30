import { CellSelection } from "prosemirror-tables";
import type { EditorState, Transaction } from "prosemirror-state";
import type { Node as PMNode, ResolvedPos } from "prosemirror-model";

/**
 * 表格的批量操作。
 * 增删行列这类"在光标处插入"的动作用 prosemirror-tables 的命令就够了；
 * 这里放的是它没提供、或者需要一次事务搞定的：整列对齐、改尺寸、删整表。
 */

export type FoundTable = { node: PMNode; pos: number };

export function findTable(state: EditorState): FoundTable | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "table") {
      return { node, pos: $from.before(d) };
    }
  }
  return null;
}

/** DOM 里某个单元格在第几列（把 colspan 算进去） */
export function colIndexOf(cell: HTMLElement): number {
  const row = cell.parentElement;
  if (!row) return 0;
  let col = 0;
  for (const c of Array.from(row.children) as HTMLElement[]) {
    if (c === cell) return col;
    col += Number(c.getAttribute("colspan") ?? 1) || 1;
  }
  return col;
}

function rebuildTableNode(node: PMNode, rows: PMNode[]): PMNode {
  return node.type.create(node.attrs, rows, node.marks);
}

/**
 * 是不是"跨多格"的表格选区。
 * 不能用 instanceof CellSelection：BlockNote 用的是 prosemirror-tables 的 STC 分支，
 * 两边的 CellSelection 不是同一个类，instanceof 恒为 false。
 */
export function isMultiCellSelection(sel: unknown): boolean {
  if (!sel || typeof sel !== "object") return false;
  const s = sel as { $anchorCell?: unknown; from?: number; to?: number };
  return s.$anchorCell !== undefined && typeof s.from === "number" && typeof s.to === "number" && s.from !== s.to;
}

/**
 * 按当前选区批量设置对齐。
 * 拖选出多格（含表头）时，选区里每一格都要改，而不是只改最后悬停的那一格。
 * 返回命中的单元格数，0 表示选区里没有单元格。
 */
export function setAlignForSelection(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  align: "left" | "center" | "right",
): number {
  const found = findTable(state);
  if (!found) return 0;
  const sel = state.selection as unknown as {
    forEachCell?: (f: (node: PMNode, pos: number) => void) => void;
  };

  // CellSelection 自带 forEachCell，直接把选区里的每一格给出来；
  // from/to 不是首尾单元格的边界，靠它们算范围会漏格子。
  const hits: { pos: number; node: PMNode }[] = [];
  if (typeof sel.forEachCell === "function") {
    sel.forEachCell((node, pos) => {
      hits.push({ pos, node });
    });
  } else {
    let rowStart = found.pos + 1;
    found.node.forEach((row) => {
      let cellStart = rowStart + 1;
      row.forEach((cell) => {
        hits.push({ pos: cellStart, node: cell });
        cellStart += cell.nodeSize;
      });
      rowStart += row.nodeSize;
    });
  }

  if (hits.length === 0) return 0;
  const tr = state.tr;
  let changed = 0;
  for (const { pos, node } of hits) {
    if (node.attrs.textAlignment === align) continue;
    tr.setNodeMarkup(pos, null, { ...node.attrs, textAlignment: align });
    changed += 1;
  }
  if (tr.docChanged) dispatch?.(tr);
  return hits.length || changed;
}

/** 给某一整列设置对齐（写 textAlignment 属性） */
export function setColumnAlign(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  colIndex: number,
  align: "left" | "center" | "right",
): boolean {
  const found = findTable(state);
  if (!found) return false;
  const rows: PMNode[] = [];
  found.node.forEach((row) => {
    const cells: PMNode[] = [];
    let col = 0;
    row.forEach((cell) => {
      const span = Number(cell.attrs.colspan ?? 1) || 1;
      const hit = colIndex >= col && colIndex < col + span;
      col += span;
      cells.push(
        hit ? cell.type.create({ ...cell.attrs, textAlignment: align }, cell.content, cell.marks) : cell,
      );
    });
    rows.push(row.type.create(row.attrs, cells, row.marks));
  });
  dispatch?.(state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, rebuildTableNode(found.node, rows)));
  return true;
}

/** 当前表格的行数与列数 */
export function tableSize(node: PMNode): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  node.forEach((row) => {
    rows += 1;
    if (rows === 1) {
      row.forEach((cell) => {
        cols += Number(cell.attrs.colspan ?? 1) || 1;
      });
    }
  });
  return { rows, cols };
}

function emptyCell(sample: PMNode): PMNode {
  const attrs = { ...sample.attrs, colspan: 1, rowspan: 1 };
  return sample.type.createAndFill(attrs) ?? sample.type.create(attrs);
}

/** 一次事务把表格改成指定行列数：多退少补，已有内容不动 */
export function resizeTable(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  targetRows: number,
  targetCols: number,
): boolean {
  const found = findTable(state);
  if (!found) return false;
  const { node } = found;
  const { rows: curRows, cols: curCols } = tableSize(node);

  const rows: PMNode[] = [];
  node.forEach((row) => {
    const cells: PMNode[] = [];
    row.forEach((cell) => cells.push(cell));

    // 列：多出来的砍掉，不够的补空
    while (cells.length > targetCols) cells.pop();
    const sample = cells[cells.length - 1];
    while (sample && cells.length < targetCols) cells.push(emptyCell(sample));

    rows.push(row.type.create(row.attrs, cells, row.marks));
  });

  // 行：多出来的砍掉，不够的复制最后一行的结构
  while (rows.length > targetRows) rows.pop();
  const lastRow = rows[rows.length - 1];
  if (lastRow) {
    while (rows.length < targetRows) {
      const cells: PMNode[] = [];
      lastRow.forEach((cell) => cells.push(emptyCell(cell)));
      rows.push(lastRow.type.create(lastRow.attrs, cells, lastRow.marks));
    }
  }

  if (curRows === targetRows && curCols === targetCols) return true;
  dispatch?.(state.tr.replaceWith(found.pos, found.pos + node.nodeSize, rebuildTableNode(node, rows)));
  return true;
}

/** 删掉整个表格 */
export function deleteTable(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
): boolean {
  const found = findTable(state);
  if (!found) return false;
  dispatch?.(state.tr.delete(found.pos, found.pos + found.node.nodeSize));
  return true;
}

/** 把某一行/列整体前移或后移（原生拖拽手柄被我们隐藏了，用这个补回来） */
export function moveRow(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  rowIndex: number,
  dir: -1 | 1,
): boolean {
  const found = findTable(state);
  if (!found) return false;
  const rows: PMNode[] = [];
  found.node.forEach((row) => rows.push(row));
  const target = rowIndex + dir;
  if (target < 0 || target >= rows.length) return false;
  const next = [...rows];
  [next[rowIndex], next[target]] = [next[target], next[rowIndex]];
  dispatch?.(
    state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, rebuildTableNode(found.node, next)),
  );
  return true;
}

/** 合并单元格的情况下不做列移动（列索引对不上，容易把内容搞乱） */
export function moveColumn(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  colIndex: number,
  dir: -1 | 1,
): boolean {
  const found = findTable(state);
  if (!found) return false;
  const target = colIndex + dir;
  const rows: PMNode[] = [];
  let ok = true;
  found.node.forEach((row) => {
    const cells: PMNode[] = [];
    row.forEach((cell) => cells.push(cell));
    if (cells.some((c) => Number(c.attrs.colspan ?? 1) > 1)) ok = false;
    if (target < 0 || target >= cells.length) ok = false;
    rows.push(cells.length ? row.type.create(row.attrs, cells, row.marks) : row);
  });
  if (!ok) return false;
  // 交换每行的两格
  const swapped: PMNode[] = [];
  for (const row of rows) {
    const cells: PMNode[] = [];
    row.forEach((cell) => cells.push(cell));
    [cells[colIndex], cells[target]] = [cells[target], cells[colIndex]];
    swapped.push(row.type.create(row.attrs, cells, row.marks));
  }
  dispatch?.(
    state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, rebuildTableNode(found.node, swapped)),
  );
  return true;
}
/**
 * 选中整行 / 整列。
 * 手机上没有鼠标拖选单元格，先选中一行再合并是唯一顺手的路径。
 */
export function selectRowOrColumn(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  mode: "row" | "col",
): boolean {
  if (!findTable(state)) return false;
  // 用当前选区解析单元格，比 posAtDOM 可靠：调用方已经把光标放进目标格
  const $from = state.selection.$from;
  let $cell = null;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "tableCell" || name === "tableHeader") {
      $cell = state.doc.resolve($from.before(d));
      break;
    }
  }
  if (!$cell) return false;

  if (mode === "col") {
    // 列里有跨列单元格时，并集的矩形会覆盖整张表，这里直接拒绝
    const table = findTable(state);
    if (!table) return false;
    const col = columnIndexOf($cell);
    let spanned = false;
    table.node.forEach((rowNode) => {
      let c = 0;
      rowNode.forEach((cellNode) => {
        const span = Number(cellNode.attrs.colspan ?? 1) || 1;
        if (col >= c && col < c + span && span > 1) spanned = true;
        c += span;
      });
    });
    if (spanned) return false;
  }

  const sel = mode === "row" ? CellSelection.rowSelection($cell) : CellSelection.colSelection($cell);
  dispatch?.(state.tr.setSelection(sel));
  return true;
}

/** 光标所在单元格是第几列（把前面的 colspan 算进去） */
function columnIndexOf($cell: ResolvedPos): number {
  const row = $cell.parent;
  let col = 0;
  for (let i = 0; i < $cell.index(); i++) {
    col += Number(row.child(i).attrs.colspan ?? 1) || 1;
  }
  return col;
}