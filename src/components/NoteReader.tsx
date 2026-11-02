import { useState, type ReactNode } from "react";
import type { NoteDoc } from "../db/notes";
import { plainTextOfBlocks } from "../lib/aggregate";
import { SparrowTableFromProps } from "./SparrowTable";
import { entityRenderers, type EntityRenderCtx } from "./reader/entityBlocks";
import { bodyChars, dateShort, timeOf } from "../lib/timeline";
import { dayStats } from "../editor/blocks/anniversary/config";
import { moodChar } from "../lib/mood";
import { amapLink } from "../editor/blocks/location/config";
import { AudioPlayer } from "../editor/blocks/_shared/AudioPlayer";
import { MediaLightbox, type PreviewMedia } from "./MediaLightbox";
import { CodeBlock } from "./CodeBlock";
import { FilePreview, type FilePreviewTarget } from "./FilePreview";
import { useSettings } from "../lib/settings";
import { readTable } from "../lib/tableContent";
import s from "./NoteReader.module.css";

type AnyBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content?: unknown;
  children?: AnyBlock[];
};

type InlineNode = {
  type?: string;
  text?: string;
  styles?: Record<string, boolean>;
  href?: string;
  content?: InlineNode[];
};

function styled(text: string, styles: Record<string, boolean> | undefined, key: string): ReactNode {
  if (!styles) return text;
  let node: ReactNode = text;
  if (styles.bold) node = <strong key={`${key}b`}>{node}</strong>;
  if (styles.italic) node = <em key={`${key}i`}>{node}</em>;
  if (styles.underline) node = <u key={`${key}u`}>{node}</u>;
  if (styles.strike) node = <s key={`${key}s`}>{node}</s>;
  if (styles.code) node = <code key={`${key}c`}>{node}</code>;
  return node;
}

function Inline({ nodes }: { nodes: unknown }): ReactNode {
  if (!Array.isArray(nodes)) return null;
  return (nodes as InlineNode[]).map((n, i) => {
    if (!n || typeof n !== "object") return null;
    if (n.type === "link") {
      return (
        <a key={i} href={n.href} target="_blank" rel="noreferrer">
          <Inline nodes={n.content} />
        </a>
      );
    }
    if (typeof n.text === "string") {
      return <span key={i}>{styled(n.text, n.styles, String(i))}</span>;
    }
    return null;
  });
}

function inlineText(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";
  return (nodes as InlineNode[])
    .map((n) => (n && typeof n.text === "string" ? n.text : ""))
    .join("");
}

function str(props: Record<string, unknown>, key: string): string {
  const v = props[key];
  return typeof v === "string" ? v.trim() : "";
}

/** BlockNote 的图片/视频块自带 textAlignment，阅读态据此对齐标题 */
function alignOf(props: Record<string, unknown>): "left" | "center" | "right" {
  const v = str(props, "textAlignment");
  return v === "center" || v === "right" ? v : "left";
}


type TableCellT = { content: unknown; colspan: number; rowspan: number };

type TableT = { rows: TableCellT[][]; headerRows: number; headerCols: number };

/** 表格内容走公共读取函数，表头行/列数从数据里取，不再写死第一行 */
function tableRows(content: unknown): TableT | null {
  const table = readTable(content);
  if (!table) return null;
  return {
    rows: table.rows.map((row) =>
      row.cells.map((cell) => ({
        content: cell?.content ?? [],
        colspan: Number(cell?.props?.colspan ?? 1) || 1,
        rowspan: Number(cell?.props?.rowspan ?? 1) || 1,
      })),
    ),
    headerRows: table.headerRows,
    headerCols: table.headerCols,
  };
}

export function NoteReader({ note }: { note: NoteDoc }) {
  // 防御：数据层出问题时（比如 blocks 被存成 JSON 字符串），只让这篇笔记空着，
  // 不要因为一个坏字段把整个页面打成白屏。
  const rawBlocks = note.blocks as unknown;
  const blocks: AnyBlock[] = Array.isArray(rawBlocks) ? (rawBlocks as AnyBlock[]) : [];
  const flat = blocks;
  const settings = useSettings();
  const [revealCard, setRevealCard] = useState(false);
  const [preview, setPreview] = useState<PreviewMedia | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreviewTarget | null>(null);
  const showCard = revealCard || settings.showCardNumber;

  const structured = flat.filter((b) =>
    ["mood", "location", "contact", "anniversary"].includes(b.type),
  );

  const metaRows: { label: string; value: ReactNode }[] = [];
  for (const b of structured) {
    if (b.type === "mood") {
      const text = inlineText(b.content);
      const emoji = str(b.props, "emoji");
      if (!text && !emoji) continue;
      metaRows.push({
        label: "心情",
        value: (
          <>
            <span className={s.stamp} aria-hidden="true">
              {moodChar(emoji)}
            </span>
            {text}
          </>
        ),
      });
    } else if (b.type === "location") {
      const name = str(b.props, "name");
      const addr = str(b.props, "addr");
      const value = name && addr.includes(name) ? addr : [name, addr].filter(Boolean).join(" · ");
      if (value) {
        const coord = str(b.props, "coord");
        metaRows.push({
          label: "地点",
          value: (
            <span>
              {value}
              <a
                className={s.tel}
                href={amapLink(name, addr, coord)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                地图
              </a>
            </span>
          ),
        });
      }
    } else if (b.type === "contact") {
      const name = str(b.props, "name");
      const rel = str(b.props, "relation");
      const phone = str(b.props, "phone");
      if (name || phone) {
        metaRows.push({
          label: "人物",
          value: (
            <span>
              {[name ? `${name}${rel ? `（${rel}）` : ""}` : "", phone]
                .filter(Boolean)
                .join(" · ")}
              {phone ? (
                <a className={s.tel} href={`tel:${phone.replace(/\s+/g, "")}`} onClick={(e) => e.stopPropagation()}>
                  拨号
                </a>
              ) : null}
            </span>
          ),
        });
      }
    } else if (b.type === "anniversary") {
      const title = str(b.props, "title");
      const date = str(b.props, "date");
      const kind = str(b.props, "kind") === "count" ? "count" : str(b.props, "kind") === "down" ? "down" : "anniversary";
      const annual = b.props.annual !== false;
      const stats = date ? dayStats(kind, date, annual) : null;
      const value = [title, stats?.num].filter(Boolean).join(" · ");
      if (value) metaRows.push({ label: "纪念日", value });
    }
  }

  const contentBlocks = flat.filter(
    (b) => !["mood", "location", "contact", "anniversary"].includes(b.type),
  );

  // 首字下沉只给「正文第一块就是段落」的笔记；开头是银行卡/清单/图片时不强行下沉
  const firstBlockIsParagraph = contentBlocks[0]?.type === "paragraph";
  let paragraphSeen = false;

  const renderInlineText = (b: AnyBlock): ReactNode => <Inline nodes={b.content} />;

  /** 同层连续的有序列表项自己数数：BlockNote 只在「自定义起始号」时才写 start，
      其它项没有索引，之前每条都渲染成 1。子列表各自从 1 重新数。 */
  const renderBlocks = (blocks: AnyBlock[], prefix: string): ReactNode[] => {
    let n = 0;
    return blocks.map((b, i) => {
      const key = `${prefix}${i}`;
      if (b.type === "numberedListItem") {
        const start = Number(b.props.start);
        n = Number.isFinite(start) && start > 0 ? start : n + 1;
        return renderBlock(b, key, n);
      }
      n = 0;
      const node = renderBlock(b, key);
      if (!node) return node;
      // 加一层定位用的包裹（不影响布局：块级 div 撑满宽度，间距仍在块自己身上）
      return (
        <div key={key} className={s.blockWrap} data-read-block={b.type}>
          {node}
        </div>
      );
    });
  };

  /** 实体/附件类块交给 reader/entityBlocks 的渲染器（那边能单独测） */
  const entityCtx: EntityRenderCtx = {
    showCard,
    onPreviewImage: (url, caption) => setPreview({ kind: "image", url, caption }),
    onPreviewFile: (target) => setFilePreview(target),
    onToggleCard: () => setRevealCard((v) => !v),
    noteDate: note.date,
  };

  const renderBlock = (b: AnyBlock, key: string, number?: number): ReactNode => {
    const fromRegistry = entityRenderers[b.type];
    if (fromRegistry) return fromRegistry(b, key, entityCtx);

    switch (b.type) {
      case "paragraph": {
        const text = inlineText(b.content);
        if (!text.trim()) return <p key={key} className={s.blank} aria-hidden="true" />;
        const first = !paragraphSeen && firstBlockIsParagraph;
        paragraphSeen = true;
        return (
          <p key={key} className={first ? `${s.p} ${s.first}` : s.p}>
            {renderInlineText(b)}
          </p>
        );
      }
      case "heading": {
        const level = Number(b.props.level ?? 1);
        const Tag = (`h${Math.min(3, Math.max(2, level + 1))}` as "h2" | "h3" | "h4");
        return (
          <Tag key={key} className={s[`h${Math.min(3, Math.max(2, level + 1))}` as "h2"]}>
            {renderInlineText(b)}
          </Tag>
        );
      }
      case "quote":
        return (
          <blockquote key={key} className={s.quote}>
            {renderInlineText(b)}
          </blockquote>
        );
      case "toggleListItem":
        // 可折叠列表：阅读态默认展开，子块照常渲染
        return (
          <div key={key} className={s.listItem}>
            <span className={s.toggleMark} aria-hidden="true">
              ▸
            </span>
            <span>
              {renderInlineText(b)}
              {b.children?.length ? (
                <span className={s.children}>{renderBlocks(b.children, `${key}-`)}</span>
              ) : null}
            </span>
          </div>
        );
      case "bulletListItem":
        return (
          <div key={key} className={s.listItem}>
            <span className={s.bullet} aria-hidden="true">
              ·
            </span>
            <span>
              {renderInlineText(b)}
              {b.children?.length ? (
                <span className={s.children}>{renderBlocks(b.children, `${key}-`)}</span>
              ) : null}
            </span>
          </div>
        );
      case "numberedListItem":
        return (
          <div key={key} className={s.listItem}>
            <span className={s.numIdx} aria-hidden="true">
              {number ?? 1}
            </span>
            <span>
              {renderInlineText(b)}
              {b.children?.length ? (
                <span className={s.children}>{renderBlocks(b.children, `${key}-`)}</span>
              ) : null}
            </span>
          </div>
        );
      case "checkListItem": {
        const checked = Boolean(b.props.checked);
        return (
          <div key={key} className={`${s.listItem} ${checked ? s.checked : ""}`}>
            <span className={s.box} aria-hidden="true">
              {checked ? "✓" : ""}
            </span>
            <span>
              {renderInlineText(b)}
              {b.children?.length ? (
                <span className={s.children}>{renderBlocks(b.children, `${key}-`)}</span>
              ) : null}
            </span>
          </div>
        );
      }
      case "codeBlock":
        return (
          <CodeBlock
            key={key}
            code={inlineText(b.content)}
            language={str(b.props, "language")}
            collapseLines={settings.codeCollapseLines}
          />
        );
      case "divider":
        return <hr key={key} className={s.divider} />;
      case "sparrowTable":
        // 自研表格（P0 只读）：格内是块数组，走独立渲染器
        return (
          <SparrowTableFromProps
            key={key}
            data={(b.props as { data?: unknown } | undefined)?.data}
            ariaLabel={note.title ? `${note.title} 里的表格` : "表格"}
          />
        );
      case "table": {
        const table = tableRows(b.content);
        if (!table) return null;
        const rows = table.rows;
        // 列数告诉 CSS：表格默认填满正文栏，但列多到每列不足最小可读宽度时才横向滚动
        const cols = rows.reduce(
          (max, row) => Math.max(max, row.reduce((sum, cell) => sum + Math.max(1, cell.colspan), 0)),
          1,
        );
        return (
          <div key={key} className={s.tableWrap}>
            <table className={s.table} style={{ ["--cols" as string]: String(cols) }}>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => {
                      // 表头行 / 表头列都渲染成真 th，读屏软件也拿得到
                      const head = ri < table.headerRows || ci < table.headerCols;
                      const Cell = head ? "th" : "td";
                      return (
                        <Cell
                          key={ci}
                          scope={ri < table.headerRows ? "col" : ci < table.headerCols ? "row" : undefined}
                          colSpan={cell.colspan > 1 ? cell.colspan : undefined}
                          rowSpan={cell.rowspan > 1 ? cell.rowspan : undefined}
                          className={head ? `${s.td} ${s.th}` : s.td}
                        >
                          <Inline nodes={cell.content} />
                        </Cell>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case "image": {
        const url = str(b.props, "url");
        if (!url) return null;
        const caption = str(b.props, "caption");
        return (
          <figure key={key} className={s.figure} data-align={alignOf(b.props)}>
            <button
              type="button"
              className={s.zoom}
              onClick={() => setPreview({ kind: "image", url, caption })}
              aria-label="全屏预览"
            >
              <img src={url} alt={caption || "笔记图片"} />
            </button>
            {caption ? <figcaption>{caption}</figcaption> : null}
          </figure>
        );
      }
      case "video": {
        const url = str(b.props, "url");
        if (!url) return null;
        const caption = str(b.props, "caption");
        return (
          <figure key={key} className={`${s.figure} ${s.figureVideo}`} data-align={alignOf(b.props)}>
            <video className={s.media} src={url} controls playsInline />
            <button
              type="button"
              className={s.expandBtn}
              onClick={() => setPreview({ kind: "video", url, caption })}
            >
              全屏预览
            </button>
            {caption ? <figcaption>{caption}</figcaption> : null}
          </figure>
        );
      }
      case "audio": {
        const url = str(b.props, "url");
        if (!url) return null;
        return <AudioPlayer key={key} src={url} wave={str(b.props, "wave")} />;
      }
      default:
        return null;
    }
  };

  return (
    <>
    <article className={s.doc} data-share-root="1">
      <h1 className={s.title}>{note.title || "无标题"}</h1>

      {metaRows.length > 0 && (
        <dl className={s.meta}>
          {metaRows.map((row, i) => (
            <div key={i} className={s.metaRow}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
          <div className={s.metaRow}>
            <dt>字数</dt>
            <dd>
              {bodyChars(note).toLocaleString("zh-CN")} 字
              {plainTextOfBlocks(note.blocks).trim() ? "" : ""}
            </dd>
          </div>
        </dl>
      )}

      <div className={s.body}>{renderBlocks(contentBlocks, "")}</div>

      <div className={s.end}>
        <span className={s.mine} aria-hidden="true">
          完
        </span>
        <span className={s.rule} />
        <span className={s.when}>{timeOf(note)} 写于 {dateShort(note.date)}</span>
      </div>
    </article>

    {preview ? <MediaLightbox media={preview} onClose={() => setPreview(null)} /> : null}
    {filePreview ? <FilePreview file={filePreview} onClose={() => setFilePreview(null)} /> : null}
  </>
  );
}
