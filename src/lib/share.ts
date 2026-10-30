/**
 * 分享用的 Markdown 序列化，两种形态：
 *   1. 单文件：附件直接内联成 base64 data URL，一个 .md 拿走全部内容
 *   2. 压缩包：附件落到 assets/ 目录，正文写相对路径，再打成 zip
 *
 * 不用 BlockNote 的 blocksToMarkdown：它要求现成的编辑器实例和 PM schema，
 * 阅读态根本没有编辑器；这里按我们自己的块类型逐个体写，输出可控。
 */

import { readTable } from "./tableContent";
import { parseSparrowTable } from "./tableData";

type InlineNode = {
  type?: string;
  text?: string;
  styles?: Record<string, boolean>;
  href?: string;
  content?: InlineNode[];
};

export type ShareBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content?: unknown;
  children?: ShareBlock[];
};

export type MediaAsset = { path: string; bytes: Uint8Array };

export type MarkdownBundle = { markdown: string; assets: MediaAsset[] };

const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function inlineToMarkdown(nodes: unknown): string {
  if (!Array.isArray(nodes)) return "";
  return (nodes as InlineNode[])
    .map((n) => {
      if (!n || typeof n !== "object") return "";
      if (n.type === "link") {
        const text = inlineToMarkdown(n.content) || n.href || "";
        return `[${text}](${n.href ?? ""})`;
      }
      let text = str(n.text);
      if (!text) return "";
      const st = n.styles ?? {};
      // 反序包裹，避免 **`x`** 之类嵌套错位
      if (st.code) text = `\`${text}\``;
      if (st.strike) text = `~~${text}~~`;
      if (st.italic) text = `*${text}*`;
      if (st.bold) text = `**${text}**`;
      return text;
    })
    .join("");
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

/** 解析 data URL：拿到 mime 与原始字节 */
export function parseDataUrl(url: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)(;[^,]*)?,([\s\S]*)$/.exec(url);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const isBase64 = (m[2] ?? "").includes("base64");
  const body = m[3];
  try {
    if (isBase64) {
      const bin = atob(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { mime, bytes };
    }
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(body)) };
  } catch {
    return null;
  }
}

function safeName(name: string): string {
  return (name || "file").replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-").slice(0, 40) || "file";
}

/** 媒体块 → Markdown；mode 决定附件是内联还是落到 assets/ */
function mediaToMarkdown(block: ShareBlock, mode: "inline" | "assets", assets: MediaAsset[]): string {
  const props = block.props ?? {};
  const url = str(props.url);
  if (!url) return "";
  const rawName = str(props.name) || str(props.fileName) || str(props.title) || "附件";
  const caption = str(props.caption);
  const isImage = block.type === "image" || block.type === "drawing";
  const label = caption || rawName;

  let target = url;
  if (url.startsWith("data:")) {
    if (mode === "inline") {
      target = url; // 单文件：直接内联 base64
    } else {
      const parsed = parseDataUrl(url);
      const ext = parsed ? (EXT_BY_MIME[parsed.mime] ?? "bin") : "bin";
      const base = safeName(rawName.replace(/\.[^.]+$/, ""));
      const path = `assets/${assets.length + 1}-${base}.${ext}`;
      if (parsed) assets.push({ path, bytes: parsed.bytes });
      target = path;
    }
  }
  return isImage ? `![${label}](${target})` : `[${label}](${target})`;
}

/** 表格：输出 GFM 表格，第一行作表头 */
function tableToMarkdown(block: ShareBlock): string {
  const table = readTable(block.content);
  if (!table) return "";
  const matrix = table.rows.map((r) =>
    Array.from({ length: table.cols }, (_, i) =>
      escapeCell(inlineToMarkdown(r.cells[i]?.content)) || " ",
    ),
  );
  // GFM 只支持单行表头：多行表头按列纵向合并，用「 / 」串起来
  const headRows = Math.max(1, table.headerRows);
  const head = Array.from({ length: table.cols }, (_, col) => {
    const parts = matrix.slice(0, headRows).map((row) => row[col]).filter((t) => t && t !== " ");
    return parts.length ? parts.join(" / ") : " ";
  });
  const body = matrix.slice(headRows);
  const lines = [
    `| ${head.join(" | ")} |`,
    `| ${Array.from({ length: table.cols }, () => "---").join(" | ")} |`,
    ...body.map((r) => `| ${r.join(" | ")} |`),
  ];
  return lines.join("\n");
}

/**
 * 自研表格（sparrowTable）的 Markdown 降级：单元格里是块数组，
 * 取每格全部文本拼接；跨行/跨列在 Markdown 里表达不了，按格子逐个铺开。
 * 原则是宁可丢结构，也不丢字。
 */
function sparrowTableToMarkdown(block: ShareBlock): string {
  const props = (block as { props?: { data?: unknown } }).props;
  const table = parseSparrowTable({ data: props?.data });
  if (!table) return "";
  const cellText = (cell: { blocks: unknown[] }): string => {
    const text = cell.blocks
      .map((b) => {
        const blk = b as {
          content?: unknown;
          props?: { url?: string; caption?: string };
        };
        const inline = inlineToMarkdown(blk.content);
        if (inline) return inline;
        if (typeof blk.props?.url === "string") return blk.props.caption || "[图片]";
        return "";
      })
      .filter(Boolean)
      .join(" ");
    return escapeCell(text) || " ";
  };
  const matrix = table.rows.map((row) => row.map(cellText));
  const headRows = Math.max(1, table.headerRows);
  const cols = Math.max(...matrix.map((r) => r.length));
  const toRow = (cells: string[]) =>
    "| " + Array.from({ length: cols }, (_, i) => cells[i] ?? " ").join(" | ") + " |";
  const head = Array.from({ length: cols }, (_, col) => {
    const parts = matrix
      .slice(0, headRows)
      .map((row) => row[col])
      .filter((t) => t && t !== " ");
    return parts.length ? parts.join(" / ") : " ";
  });
  return [
    toRow(head),
    toRow(Array.from({ length: cols }, () => "---")),
    ...matrix.slice(headRows).map(toRow),
  ].join("\n");
}

/** 自定义块：用「标签：值」的形式保留信息 */
const CUSTOM_LABEL: Record<string, string> = {
  mood: "心情",
  location: "地点",
  contact: "人物",
  anniversary: "纪念日",
  bookmark: "书签",
  account: "账号",
  bankcard: "银行卡",
  checklist: "清单",
  voice: "语音",
};

function customToMarkdown(block: ShareBlock, mode: "inline" | "assets", assets: MediaAsset[]): string {
  const label = CUSTOM_LABEL[block.type] ?? block.type;
  const text = inlineToMarkdown(block.content).trim();
  const props = block.props ?? {};
  const bits: string[] = [];
  for (const key of ["mood", "name", "place", "title", "value", "text", "date", "label"]) {
    const v = str(props[key]).trim();
    if (v) bits.push(v);
  }
  // 语音块带音频地址，一起导出
  const media = str(props.url);
  if (media) {
    const inner = mediaToMarkdown({ ...block, type: "audio" }, mode, assets);
    if (inner) bits.push(inner);
  }
  const detail = text || bits.join(" · ");
  return detail ? `> **${label}**：${detail}` : `> **${label}**`;
}

function blockToMarkdown(
  block: ShareBlock,
  indent: number,
  mode: "inline" | "assets",
  assets: MediaAsset[],
): string {
  const pad = "  ".repeat(indent);
  const text = inlineToMarkdown(block.content);
  const props = block.props ?? {};

  switch (block.type) {
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(props.level ?? 1) || 1));
      return text ? `${pad}${"#".repeat(level)} ${text}` : "";
    }
    case "bulletListItem":
      return `${pad}- ${text}`;
    case "numberedListItem":
      return `${pad}1. ${text}`;
    case "checkListItem": {
      const checked = props.checked === true;
      return `${pad}- [${checked ? "x" : " "}] ${text}`;
    }
    case "quote":
      return text ? `${pad}> ${text}` : "";
    case "codeBlock": {
      const lang = str(props.language) || "";
      const code = Array.isArray(block.content)
        ? (block.content as { text?: string }[]).map((c) => str(c.text)).join("")
        : str(block.content);
      return `${pad}\`\`\`${lang}\n${code}\n${pad}\`\`\``;
    }
    case "table":
      return tableToMarkdown(block);
    case "sparrowTable":
      return sparrowTableToMarkdown(block);
    case "image":
    case "video":
    case "audio":
    case "file":
    case "drawing":
      return mediaToMarkdown(block, mode, assets);
    case "divider":
      return `${pad}---`;
    case "paragraph":
      return `${pad}${text}`;
    default:
      if (CUSTOM_LABEL[block.type]) return customToMarkdown(block, mode, assets);
      return text ? `${pad}${text}` : "";
  }
}

function renderBody(
  blocks: ShareBlock[],
  meta: { title: string; date?: string },
  mode: "inline" | "assets",
  assets: MediaAsset[],
): string {
  const head: string[] = [`# ${meta.title || "无标题"}`, ""];
  if (meta.date) head.push(`> ${meta.date}`, "");
  const parts = (blocks ?? []).map((b) => {
    const self = blockToMarkdown(b, 0, mode, assets);
    const kids = (b.children ?? []).map((c) => blockToMarkdown(c, 1, mode, assets)).filter(Boolean);
    return [self, ...kids].filter(Boolean).join("\n");
  });
  const body = parts.filter(Boolean).join("\n\n");
  return `${head.join("\n")}${body}\n`;
}

/** 单文件：附件内联成 base64 */
export function noteToMarkdown(
  blocks: ShareBlock[],
  meta: { title: string; date?: string; createdAt?: number },
): string {
  return renderBody(blocks, meta, "inline", []);
}

/** 压缩包形态：附件抽出到 assets/，正文写相对路径 */
export function noteToMarkdownWithAssets(
  blocks: ShareBlock[],
  meta: { title: string; date?: string; createdAt?: number },
): MarkdownBundle {
  const assets: MediaAsset[] = [];
  const markdown = renderBody(blocks, meta, "assets", assets);
  return { markdown, assets };
}

/** 文件名：去掉非法字符 */
export function markdownFileName(title: string, ext = "md"): string {
  const safe = (title || "无标题").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  return `${safe}.${ext}`;
}
