/**
 * 表格多选与合并。
 * 多选是应用层状态（BlockNote 没有块级多选），合并、批量表头都基于选中的块 id。
 */

export type CellJson = { type: string; content: unknown[]; props: Record<string, unknown> };
export type RowJson = { cells: CellJson[] };
export type TableContent = {
  type: "tableContent";
  rows: RowJson[];
  columnWidths?: (number | null)[];
  headerRows?: number;
  headerCols?: number;
};

const EMPTY_CELL: CellJson = { type: "tableCell", content: [], props: {} };

export function isTableContent(value: unknown): value is TableContent {
  if (!value || typeof value !== "object") return false;
  const c = value as { type?: unknown; rows?: unknown };
  return c.type === "tableContent" && Array.isArray(c.rows);
}

/** 一行占了几个「逻辑列」（把 colspan 算进去） */
export function rowWidth(row: RowJson): number {
  return row.cells.reduce((n, c) => n + (Number(c.props?.colspan ?? 1) || 1), 0);
}

/**
 * 把多张表按顺序拼成一张：列数取最大值，短的行补空格。
 * 合并单元格（colspan/rowspan）原样保留，不做拆分。
 */
export function mergeTableContents(contents: TableContent[]): TableContent {
  if (contents.length === 0) return { type: "tableContent", rows: [] };
  const width = Math.max(...contents.map((c) => Math.max(0, ...c.rows.map(rowWidth))));
  const rows: RowJson[] = [];
  for (const content of contents) {
    for (const row of content.rows) {
      const cells = [...row.cells];
      const missing = width - rowWidth(row);
      for (let i = 0; i < missing; i++) cells.push({ ...EMPTY_CELL, props: { ...EMPTY_CELL.props } });
      rows.push({ cells });
    }
  }
  const first = contents[0];
  return {
    type: "tableContent",
    rows,
    // 表头只看第一张，列宽不跨表沿用（各表列宽本来就不同）
    headerRows: first.headerRows,
    headerCols: first.headerCols,
  };
}

/** 批量设置表头：number 表示表头行/列数，undefined 表示取消 */
export function withHeaders(
  content: TableContent,
  patch: { headerRows?: number; headerCols?: number },
): TableContent {
  const next: TableContent = { ...content };
  if ("headerRows" in patch) {
    if (patch.headerRows === undefined) delete next.headerRows;
    else next.headerRows = patch.headerRows;
  }
  if ("headerCols" in patch) {
    if (patch.headerCols === undefined) delete next.headerCols;
    else next.headerCols = patch.headerCols;
  }
  return next;
}
