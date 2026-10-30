import type { ReactNode } from "react";
import { columnCount, parseSparrowTable, type SparrowTable as SparrowTableData } from "../lib/tableData";
import s from "./SparrowTable.module.css";

/**
 * 自研表格的只读渲染（P0）。
 *
 * 与内置 table 的差别：单元格里是**块数组**，所以这里要按块类型渲染，
 * 不能只渲染行内内容。P0 只支持最常见几种：段落 / 标题 / 列表 / 图片 / 引用 / 代码。
 */

/** 单元格里的一行文字（含加粗等基本样式） */
function Inline({ nodes }: { nodes: unknown }) {
  if (!Array.isArray(nodes)) return null;
  return (
    <>
      {nodes.map((raw, i) => {
        if (!raw || typeof raw !== "object") return null;
        const n = raw as { type?: string; text?: string; styles?: Record<string, boolean>; href?: string };
        if (n.type === "link") {
          const inner = (raw as { content?: unknown }).content;
          return (
            <a key={i} href={n.href} className={s.link}>
              {Array.isArray(inner) && inner.length > 0 ? <Inline nodes={inner} /> : n.href}
            </a>
          );
        }
        const text = typeof n.text === "string" ? n.text : "";
        if (!text) return null;
        const st = n.styles ?? {};
        let node: ReactNode = text;
        if (st.code) node = <code className={s.code}>{node}</code>;
        if (st.bold) node = <strong>{node}</strong>;
        if (st.italic) node = <em>{node}</em>;
        if (st.strike) node = <s>{node}</s>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

/** 单元格里的一个块 */
function CellBlock({ block }: { block: unknown }) {
  if (!block || typeof block !== "object") return null;
  const b = block as {
    type?: string;
    props?: Record<string, unknown>;
    content?: unknown;
    children?: unknown[];
  };
  switch (b.type) {
    case "image": {
      const url = typeof b.props?.url === "string" ? b.props.url : "";
      if (!url) return null;
      const caption = typeof b.props?.caption === "string" ? b.props.caption : "";
      return (
        <figure className={s.figure}>
          {/* 用户自己插的图，没有固定尺寸 */}
          <img className={s.img} src={url} alt={caption || "图片"} loading="lazy" />
          {caption && <figcaption className={s.figcap}>{caption}</figcaption>}
        </figure>
      );
    }
    case "codeBlock": {
      const code = Array.isArray(b.content)
        ? (b.content as { text?: string }[]).map((n) => n.text ?? "").join("")
        : "";
      return <pre className={s.pre}>{code}</pre>;
    }
    case "quote":
      return (
        <blockquote className={s.quote}>
          <Inline nodes={b.content} />
        </blockquote>
      );
    case "heading": {
      const level = Number(b.props?.level ?? 1);
      return (
        <p className={level <= 2 ? s.head2 : s.head3}>
          <Inline nodes={b.content} />
        </p>
      );
    }
    case "bulletListItem":
    case "numberedListItem":
    case "checkListItem": {
      const checked = b.props?.checked === true;
      return (
        <p className={s.listItem}>
          <span className={s.bullet} aria-hidden="true">
            {b.type === "checkListItem" ? (checked ? "☑" : "☐") : b.type === "numberedListItem" ? "·" : "·"}
          </span>
          <Inline nodes={b.content} />
        </p>
      );
    }
    default:
      return (
        <p className={s.p}>
          <Inline nodes={b.content} />
        </p>
      );
  }
}

export function SparrowTable({
  table,
  minWidth,
  ariaLabel,
}: {
  table: SparrowTableData;
  minWidth?: number;
  /** 给读屏软件的表格说明，例如「阅读统计」 */
  ariaLabel?: string;
}) {
  const cols = columnCount(table);
  return (
    <div className={s.wrap}>
      <table
        aria-label={ariaLabel ?? "表格"}
        className={s.table}
        style={{
          // 列宽由内容决定，再给一个最小宽度避免窄屏挤成一条
          minWidth: minWidth ? `${minWidth}ch` : undefined,
          ["--sparrow-cols" as string]: String(cols),
        }}
      >
        {table.headerRows > 0 && (
          <thead>
            {table.rows.slice(0, table.headerRows).map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <th
                    key={ci}
                    scope="col"
                    colSpan={cell.colspan > 1 ? cell.colspan : undefined}
                    rowSpan={cell.rowspan > 1 ? cell.rowspan : undefined}
                    className={`${s.cell} ${s.head}`}
                  >
                    {cell.blocks.map((block, bi) => (
                      <CellBlock key={bi} block={block} />
                    ))}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        )}
        <tbody>
          {table.rows.slice(table.headerRows).map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  scope={ci < table.headerCols ? "row" : undefined}
                  colSpan={cell.colspan > 1 ? cell.colspan : undefined}
                  rowSpan={cell.rowspan > 1 ? cell.rowspan : undefined}
                  className={ci < table.headerCols ? `${s.cell} ${s.head}` : s.cell}
                >
                  {cell.blocks.map((block, bi) => (
                    <CellBlock key={bi} block={block} />
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 从块 props 直接渲染（调用方给的是原始 props.data） */
export function SparrowTableFromProps({
  data,
  minWidth,
  ariaLabel,
}: {
  data?: unknown;
  minWidth?: number;
  ariaLabel?: string;
}) {
  const table = parseSparrowTable({ data });
  if (!table) return <div className={s.broken}>这张表的数据读不出来</div>;
  return <SparrowTable table={table} minWidth={minWidth} ariaLabel={ariaLabel} />;
}
