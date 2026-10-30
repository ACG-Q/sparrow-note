import { readTable, type TableModel } from "./tableContent";
import { columnCount, parseSparrowTable } from "./tableData";

/**
 * 统一的表格读取口径。
 *
 * 现在库里并存两种表格块：
 * - `table`：BlockNote 内置表格，单元格是行内内容（`readTable`）
 * - `sparrowTable`：自研表格，单元格是**块数组**（`parseSparrowTable`）
 *
 * 消费方（阅读态 / PDF / Markdown）以前各写两条分支，每加一个特性就要乘 2。
 * 这里把两者折成同一个只读模型：格子里统一是「纯文本 + 块数组」，
 * 内置表格的块数组只有一个段落，自研表格的照原样给出。
 */

export type UnifiedCell = {
  /** 纯文本（已裁掉首尾空白） */
  text: string;
  /** 格子里的块：内置表格是 [{ content: 行内节点 }]，自研表格是原样的块数组 */
  blocks: unknown[];
  colspan: number;
  rowspan: number;
};

export type UnifiedTable = {
  kind: "table" | "sparrowTable";
  rows: UnifiedCell[][];
  headerRows: number;
  headerCols: number;
  cols: number;
};

/** 从内置表格模型折成统一模型（格子里的内容当作行内节点塞进一个段落） */
function fromTableModel(model: TableModel): UnifiedTable {
  const rows = model.rows.map((row) =>
    row.cells.map((cell) => ({
      text: "",
      blocks: [{ type: "paragraph", props: {}, content: cell.content, children: [] }],
      colspan: Math.max(1, Number(cell.props?.colspan) || 1),
      rowspan: Math.max(1, Number(cell.props?.rowspan) || 1),
    })),
  );
  return {
    kind: "table",
    rows,
    headerRows: model.headerRows,
    headerCols: model.headerCols,
    cols: model.cols,
  };
}

const textOfBlocks = (blocks: unknown): string => {
  if (!Array.isArray(blocks)) return "";
  const parts: string[] = [];
  const walk = (list: unknown[]) => {
    for (const b of list) {
      if (!b || typeof b !== "object") continue;
      const blk = b as {
        content?: unknown;
        children?: unknown;
        props?: { caption?: unknown; name?: unknown };
      };
      if (Array.isArray(blk.content)) {
        for (const n of blk.content) {
          const node = n as { text?: unknown; content?: unknown };
          if (typeof node.text === "string") parts.push(node.text);
          else if (Array.isArray(node.content)) walk([node.content]);
        }
      }
      if (Array.isArray(blk.children)) walk(blk.children);
      if (parts.length === 0) {
        const caption = blk.props?.caption ?? blk.props?.name;
        if (typeof caption === "string" && caption.trim()) parts.push(caption.trim());
      }
    }
  };
  walk(blocks);
  return parts.join(" ").replace(/\s+/g, " ").trim();
};

/**
 * 读任意一种表格块，读不出来返回 null。
 * `block` 只要带 `type` 与 `content` / `props` 即可（不依赖 BlockNote 类型）。
 */
export function readAnyTable(block: {
  type?: string;
  content?: unknown;
  props?: Record<string, unknown>;
}): UnifiedTable | null {
  if (!block || typeof block !== "object") return null;

  if (block.type === "sparrowTable") {
    const model = parseSparrowTable({ data: block.props?.data });
    if (!model) return null;
    const rows = model.rows.map((row) =>
      row.map((cell) => ({
        text: textOfBlocks(cell.blocks),
        blocks: cell.blocks,
        colspan: cell.colspan,
        rowspan: cell.rowspan,
      })),
    );
    return {
      kind: "sparrowTable",
      rows,
      headerRows: model.headerRows,
      headerCols: model.headerCols,
      cols: Math.max(1, columnCount(model)),
    };
  }

  if (block.type === "table") {
    const model = readTable(block.content);
    if (!model) return null;
    const unified = fromTableModel(model);
    // 内置表格的文本要单独抽（blocks 里存的是行内节点）
    for (const row of unified.rows) {
      for (const cell of row) {
        const para = cell.blocks[0] as { content?: unknown } | undefined;
        cell.text = textOfBlocks([{ content: para?.content }]);
      }
    }
    return unified;
  }

  return null;
}

/** 是不是这两种表格之一（给分支判断用，避免各处写字符串） */
export function isTableBlock(type: string | undefined): boolean {
  return type === "table" || type === "sparrowTable";
}
