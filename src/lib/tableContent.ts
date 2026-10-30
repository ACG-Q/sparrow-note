/**
 * 表格内容的统一读取口径。
 *
 * BlockNote 的表格 JSON 是 { rows: [{ cells: [...] }], headerRows?, headerCols? }，
 * 但各处消费方（编辑器菜单、阅读模式、PDF、Markdown）以前各写各的：
 * 阅读模式只认第一行，PDF 只重复第一行。这里收成一份，顺带做边界收口。
 */

export type TableCellLike = {
  props?: { colspan?: number; rowspan?: number };
  content?: unknown;
};

export type TableContentLike = {
  rows?: { cells?: TableCellLike[] }[];
  headerRows?: number;
  headerCols?: number;
};

export type TableModel = {
  rows: { cells: TableCellLike[] }[];
  /** 网格宽（按最长一行算） */
  cols: number;
  /** 表头行数，已夹到 [0, rows.length] */
  headerRows: number;
  /** 表头列数，已夹到 [0, cols] */
  headerCols: number;
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** 读表格内容；空表返回 null，调用方据此不渲染 */
export function readTable(content: unknown): TableModel | null {
  const c = content as TableContentLike | null | undefined;
  const rawRows = Array.isArray(c?.rows) ? c.rows : [];
  const rows = rawRows.map((r) => ({
    cells: Array.isArray(r?.cells) ? r.cells : [],
  }));
  if (rows.length === 0) return null;

  const cols = Math.max(1, ...rows.map((r) => r.cells.length));
  return {
    rows,
    cols,
    headerRows: clamp(Number(c?.headerRows ?? 0), 0, rows.length),
    headerCols: clamp(Number(c?.headerCols ?? 0), 0, cols),
  };
}

/** 这个格子是不是表头：落在表头行或表头列里 */
export function isHeaderCell(table: TableModel, row: number, col: number): boolean {
  return row < table.headerRows || col < table.headerCols;
}

/** 表头一共几行（Markdown 这种只支持单行表头的格式会用它做合并） */
export function headerRowCount(content: unknown): number {
  return readTable(content)?.headerRows ?? 0;
}
