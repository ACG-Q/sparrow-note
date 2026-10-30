/**
 * 自研表格（sparrowTable）的数据模型与校验。
 *
 * 与 BlockNote 内置表格的区别：单元格里放的是**块数组**，不是行内内容。
 * 这样格内可以放图片、代码块、清单——内置 table 的 schema 做不到。
 *
 * P0 阶段只做「读」：能解析、能渲染，不接编辑。
 */

export type SparrowCell = {
  /** 数据存在 props 里是 JSON 字符串，这里统一成对象 */
  blocks: unknown[];
  colspan: number;
  rowspan: number;
};

export type SparrowTable = {
  headerRows: number;
  headerCols: number;
  rows: SparrowCell[][];
};

export type SparrowTableProps = {
  /** JSON 字符串：{ headerRows, headerCols, rows: [[{ blocks, colspan, rowspan }]] } */
  data?: string;
  /** 单元格最小宽度（ch），用于渲染时给 col 一个底 */
  cellMinWidth?: number;
};

const int = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

/**
 * 解析 props.data。坏数据不抛异常，返回 null 让调用方渲染占位/回退。
 * 校验点：rows 必须是二维数组；每个单元格必须有数组 blocks。
 */
export function parseSparrowTable(props: { data?: unknown }): SparrowTable | null {
  const raw = typeof props.data === "string" ? props.data : null;
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const rec = value as { rows?: unknown; headerRows?: unknown; headerCols?: unknown };
  if (!Array.isArray(rec.rows) || rec.rows.length === 0) return null;

  const rows: SparrowCell[][] = [];
  for (const row of rec.rows) {
    if (!Array.isArray(row)) return null;
    const cells: SparrowCell[] = [];
    for (const cell of row) {
      if (!cell || typeof cell !== "object") return null;
      const c = cell as { blocks?: unknown; colspan?: unknown; rowspan?: unknown };
      if (!Array.isArray(c.blocks)) return null;
      cells.push({
        blocks: c.blocks,
        colspan: Math.max(1, int(c.colspan, 1)),
        rowspan: Math.max(1, int(c.rowspan, 1)),
      });
    }
    if (cells.length === 0) return null;
    rows.push(cells);
  }

  return {
    headerRows: Math.min(int(rec.headerRows, 0), rows.length),
    headerCols: Math.min(int(rec.headerCols, 0), Math.max(...rows.map((r) => r.length))),
    rows,
  };
}

/** 一共几列（按每行 colspan 求和取最大） */
export function columnCount(table: SparrowTable): number {
  return Math.max(
    ...table.rows.map((row) => row.reduce((sum, cell) => sum + cell.colspan, 0)),
  );
}

/** 新建表格时的空表：1 行表头 + 2 行 × 3 列 */
export function emptySparrowTable(rows = 3, cols = 3): string {
  const cell = () => ({
    blocks: [{ type: "paragraph", props: {}, content: [{ type: "text", text: "", styles: {} }], children: [] }],
    colspan: 1,
    rowspan: 1,
  });
  return JSON.stringify({
    headerRows: 1,
    headerCols: 0,
    rows: Array.from({ length: rows }, () => Array.from({ length: cols }, cell)),
  });
}

/** 顺带把 props 里的 JSON 序列化出来，供以后编辑态写回 */
export function serializeSparrowTable(table: SparrowTable): string {
  return JSON.stringify({
    headerRows: table.headerRows,
    headerCols: table.headerCols,
    rows: table.rows.map((row) =>
      row.map((cell) => ({
        blocks: cell.blocks,
        colspan: cell.colspan,
        rowspan: cell.rowspan,
      })),
    ),
  });
}
