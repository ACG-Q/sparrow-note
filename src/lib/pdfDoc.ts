/**
 * 矢量文字 PDF 排版。
 * 用 pdf-lib + 内嵌中文字体（子集）自己排：标题、正文、列表、引用、代码块、表格、图片。
 * 不引入 html2pdf 之类——它们最后还是栅格化，中文变成图片。
 */
import { readTable } from "./tableContent";
import { columnCount, parseSparrowTable } from "./tableData";
import { layoutTable, rowTops } from "./pdf/tableLayout";
import { parseDataUrl, type ShareBlock } from "./share";

export type PdfMeta = { title: string; date?: string };

const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

const F_BODY = 10.5;
const F_SMALL = 9;
const F_CODE = 8.8;
const LH = 1.72;
const HEADING_SIZE: Record<number, number> = { 1: 21, 2: 16, 3: 13.5, 4: 12, 5: 11, 6: 10.5 };

type Rgb = { r: number; g: number; b: number };
const C_INK: Rgb = { r: 0.098, g: 0.09, b: 0.074 };
const C_MUTED: Rgb = { r: 0.42, g: 0.39, b: 0.34 };
const C_SEAL: Rgb = { r: 0.54, g: 0.2, b: 0.14 };
const C_RULE: Rgb = { r: 0.85, g: 0.82, b: 0.75 };
const C_CODE_BG: Rgb = { r: 0.94, g: 0.92, b: 0.88 };

/** 测量函数：由调用方提供（正式是 pdf-lib 的 font.widthOfTextAtSize） */
export type Measure = (text: string, size: number) => number;

type Atom = { text: string; bold: boolean; code: boolean; link: boolean };

/** 行内内容拆成可断行的原子：中文按字断，拉丁按词断 */
export function toAtoms(nodes: unknown): Atom[] {
  const out: Atom[] = [];
  const walk = (list: unknown, style: { bold?: boolean; code?: boolean; link?: boolean }) => {
    if (!Array.isArray(list)) return;
    for (const n of list as { type?: string; text?: string; styles?: Record<string, boolean>; content?: unknown }[]) {
      if (!n || typeof n !== "object") continue;
      if (n.type === "link") {
        walk(n.content, { ...style, link: true });
        continue;
      }
      const text = typeof n.text === "string" ? n.text : "";
      if (!text) continue;
      const bold = style.bold || Boolean(n.styles?.bold);
      const code = style.code || Boolean(n.styles?.code);
      const link = style.link || false;
      // 拉丁词整体、CJK 单字
      const parts = text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]|[^\s\u4e00-\u9fff]+|\s+/g) ?? [text];
      for (const p of parts) {
        if (p === "") continue;
        out.push({ text: p, bold, code, link });
      }
    }
  };
  walk(nodes, {});
  return out;
}

export type Line = { atoms: Atom[]; text: string; width: number };

/** 贪心折行 */
export function wrapAtoms(atoms: Atom[], maxWidth: number, size: number, measure: Measure): Line[] {
  const lines: Line[] = [];
  let cur: Atom[] = [];
  let curW = 0;
  const flush = () => {
    const text = cur.map((a) => a.text).join("");
    if (text.trim() !== "" || cur.length > 0) lines.push({ atoms: cur, text, width: curW });
    cur = [];
    curW = 0;
  };
  for (const atom of atoms) {
    if (atom.text === "\n") {
      flush();
      continue;
    }
    const w = measure(atom.text, size);
    if (curW + w > maxWidth && cur.length > 0) {
      // 空格不放到行首
      if (atom.text.trim() === "" && atom.text !== "") {
        continue;
      }
      flush();
    }
    cur.push(atom);
    curW += w;
  }
  if (cur.length > 0) flush();
  return lines;
}

/** 把块树摊平成绘制指令 */
type Draw = (ctx: Ctx) => void;

export type Ctx = {
  page: unknown;
  y: number;
  newPage: () => void;
  ensure: (h: number) => void;
  drawText: (text: string, x: number, y: number, opts: { size: number; bold?: boolean; color?: { r: number; g: number; b: number } }) => void;
  measure: Measure;
  drawRect: (x: number, y: number, w: number, h: number, color: { r: number; g: number; b: number }) => void;
  drawLine: (x1: number, y1: number, x2: number, y2: number, color: { r: number; g: number; b: number }, thickness?: number) => void;
  drawImage: (bytes: Uint8Array, mime: string, x: number, y: number, w: number, h: number) => Promise<void>;
  embedImage: (bytes: Uint8Array, mime: string) => Promise<{ img: unknown; width: number; height: number }>;
};

/** 供 UI 预览/测试用的纯排版（不落 PDF） */
export function textOfBlocks(blocks: ShareBlock[]): string {
  const lines: string[] = [];
  const walk = (list: ShareBlock[], depth: number) => {
    for (const b of list) {
      const text = toAtoms(b.content).map((a) => a.text).join("").trim();
      if (text) lines.push(`${"  ".repeat(depth)}${text}`);
      if (b.children?.length) walk(b.children, depth + 1);
    }
  };
  walk(blocks, 0);
  return lines.join("\n");
}

/** SVG 不能直接进 PDF：先画到 canvas 再取 PNG 字节 */
async function svgToPngBytes(url: string, targetW = 900): Promise<Uint8Array | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("svg load failed"));
      i.src = url;
    });
    const w = targetW;
    const h = Math.round((img.height || 1) / (img.width || 1) * w) || targetW;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

/** 生成带字体子集的 PDF */
export async function buildNotePdf(
  blocks: ShareBlock[],
  meta: PdfMeta,
  fontBytes: ArrayBuffer,
  boldBytes?: ArrayBuffer,
): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  // 粗体是独立子集；没有就用常规体（下面按字符覆盖情况自动退）
  const boldFont = boldBytes ? await pdf.embedFont(boldBytes, { subset: true }) : null;
  const boldCovered = (() => {
    if (!boldFont) return () => false;
    try {
      const charset = (boldFont as unknown as { getCharacterSet?: () => number[] }).getCharacterSet?.();
      if (!charset) return () => true;
      const set = new Set(charset);
      return (cp: number) => set.has(cp);
    } catch {
      return () => true;
    }
  })();
  pdf.setTitle(meta.title || "麻雀记");
  pdf.setCreator("麻雀记");

  const measure = (text: string, size: number) => font.widthOfTextAtSize(text, size);
  const color = (c: { r: number; g: number; b: number }) => rgb(c.r, c.g, c.b);
  const imageCache = new Map<string, { img: unknown; width: number; height: number }>();

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  const ensure = (h: number) => {
    if (y - h < MARGIN) newPage();
  };

  const drawText = (
    text: string,
    x: number,
    yy: number,
    opts: { size: number; bold?: boolean; color?: { r: number; g: number; b: number } },
  ) => {
    const c = color(opts.color ?? C_INK);
    // 粗体子集只收常用字：有缺字就退回常规体，避免出现空白方框
    let useFont = font;
    if (opts.bold && boldFont) {
      let ok = true;
      for (const ch of text) {
        if (!boldCovered(ch.codePointAt(0) ?? 0)) {
          ok = false;
          break;
        }
      }
      if (ok) useFont = boldFont;
    }
    page.drawText(text, { x, y: yy, size: opts.size, font: useFont, color: c });
  };

  const drawRect = (x: number, yy: number, w: number, h: number, c: { r: number; g: number; b: number }) => {
    page.drawRectangle({ x, y: yy, width: w, height: h, color: color(c) });
  };

  const drawLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    c: { r: number; g: number; b: number } = C_RULE,
    thickness = 0.7,
  ) => {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color: color(c), thickness });
  };

  const embedImage = async (bytes: Uint8Array, mime: string) => {
    const key = `${mime}:${bytes.length}:${bytes[0] ?? 0}`;
    const hit = imageCache.get(key);
    if (hit) return hit as { img: unknown; width: number; height: number };
    const img = mime.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const entry = { img, width: img.width, height: img.height };
    imageCache.set(key, entry);
    return entry;
  };

  /** 标题区 */
  const drawTitle = () => {
    const size = 24;
    const lines = wrapAtoms(toAtoms([{ type: "text", text: meta.title || "无标题", styles: {} }]), CONTENT_W, size, measure);
    for (const line of lines) {
      ensure(size * 1.4);
      y -= size * 1.15;
      drawText(line.text, MARGIN, y, { size, bold: true });
    }
    y -= 10;
    if (meta.date) {
      y -= 12;
      drawText(meta.date, MARGIN, y, { size: F_SMALL, color: C_MUTED });
    }
    y -= 14;
    drawLine(MARGIN, y, PAGE_W - MARGIN, y, C_INK, 1.2);
    y -= 16;
  };

  /** 行内绘制（含粗体/代码底/链接下划线），返回实际宽度 */
  const drawAtoms = (atoms: Atom[], size: number, x0: number, yy: number, baseColor = C_INK) => {
    let x = x0;
    for (const a of atoms) {
      const w = measure(a.text, size);
      const c = a.link ? C_SEAL : a.code ? C_SEAL : baseColor;
      if (a.code) drawRect(x - 1, yy - size * 0.22, w + 2, size * 1.15, C_CODE_BG);
      drawText(a.text, x, yy, { size, bold: a.bold, color: c });
      if (a.link) drawLine(x, yy - 1.6, x + w, yy - 1.6, C_SEAL, 0.5);
      x += w;
    }
    return x - x0;
  };

  /** 段落（可缩进、可带项目符号、可带左边线） */
  const drawParagraph = (
    nodes: unknown,
    opts: {
      size?: number;
      indent?: number;
      bullet?: string;
      color?: { r: number; g: number; b: number };
      bar?: boolean;
      bold?: boolean;
    } = {},
  ) => {
    const size = opts.size ?? F_BODY;
    const indent = opts.indent ?? 0;
    const left = MARGIN + indent;
    const width = CONTENT_W - indent - (opts.bullet ? 12 : 0);
    const atoms = toAtoms(nodes);
    if (atoms.length === 0) {
      y -= size * LH * 0.6;
      return;
    }
    const lines = wrapAtoms(atoms, width, size, measure);
    const x0 = left + (opts.bullet ? 12 : 0);
    lines.forEach((line, i) => {
      const lineH = size * LH;
      ensure(lineH);
      y -= lineH;
      if (i === 0 && opts.bullet) drawText(opts.bullet, left, y, { size, color: opts.color ?? C_INK });
      if (opts.bar) drawLine(left - 8, y - 2, left - 8, y + lineH - 4, C_SEAL, 1.6);
      drawAtoms(line.atoms, size, x0, y, opts.color ?? C_INK);
    });
    y -= size * 0.42;
  };

  /** 代码块：底色 + 不换行折行（按字宽硬折） */
  const drawCode = (block: ShareBlock) => {
    const props = block.props ?? {};
    const lang = typeof props.language === "string" ? props.language : "";
    const raw = Array.isArray(block.content)
      ? (block.content as { text?: string }[]).map((c) => (typeof c.text === "string" ? c.text : "")).join("")
      : typeof block.content === "string"
        ? block.content
        : "";
    const size = F_CODE;
    const lines: string[] = [];
    for (const rawLine of raw.split("\n")) {
      let rest = rawLine;
      while (measure(rest, size) > CONTENT_W - 16 && rest.length > 1) {
        let cut = rest.length;
        while (cut > 1 && measure(rest.slice(0, cut), size) > CONTENT_W - 16) cut -= 1;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      lines.push(rest);
    }
    const blockH = lines.length * size * 1.5 + 16;
    const startY = y;
    // 代码块整体放一页；太长就从头开始新页
    if (blockH > PAGE_H - MARGIN * 2) {
      lines.length = Math.floor((PAGE_H - MARGIN * 2 - 16) / (size * 1.5));
    }
    ensure(Math.min(blockH, PAGE_H - MARGIN * 2));
    const drawnH = Math.min(blockH, PAGE_H - MARGIN * 2);
    drawRect(MARGIN, y - drawnH, CONTENT_W, drawnH, C_CODE_BG);
    if (lang) drawText(lang, MARGIN + 8, y - 10, { size: 7.5, color: C_MUTED });
    let ly = y - 16;
    for (const line of lines) {
      ly -= size * 1.5;
      if (ly < MARGIN + 4) break;
      drawText(line, MARGIN + 8, ly, { size, color: C_INK });
    }
    y = startY - drawnH - 10;
  };

  /** 表格：等宽列 + 边框 + 单元格折行 */
  const drawTable = (block: ShareBlock) => {
    const content = block.content as { rows?: { cells: { content?: unknown }[] }[] } | undefined;
    const rows = content?.rows ?? [];
    if (rows.length === 0) return;
    const cols = Math.max(...rows.map((r) => r.cells.length));
    const cellPad = 4;
    const colW = CONTENT_W / cols;
    const size = F_SMALL;
    // 表头行数走公共读取口径（越界会被夹紧）
    const tableModel = readTable(block.content);
    const headerRows = tableModel?.headerRows ?? 0;

    // 表头行预先排好，翻页时重画一遍
    const layoutRow = (r: number) => {
      const cells = Array.from({ length: cols }, (_, i) => rows[r].cells[i]?.content ?? []);
      const wrapped = cells.map((c) => wrapAtoms(toAtoms(c), colW - cellPad * 2, size, measure));
      const lineCount = Math.max(1, ...wrapped.map((w) => w.length));
      return { wrapped, rowH: lineCount * size * 1.5 + cellPad * 2 };
    };

    const paintRow = (layout: { wrapped: Line[][]; rowH: number }) => {
      const top = y;
      y -= layout.rowH;
      for (let c = 0; c < cols; c++) {
        const x = MARGIN + c * colW;
        drawLine(x, top, x, y, C_RULE, 0.6);
        layout.wrapped[c].forEach((line, li) => {
          drawAtoms(
            line.atoms,
            size,
            x + cellPad,
            y + layout.rowH - cellPad - size * (li + 1) * 1.5 + size * 0.28,
            C_INK,
          );
        });
      }
      drawLine(MARGIN, top, PAGE_W - MARGIN, top, C_RULE, 0.6);
      drawLine(MARGIN, y, PAGE_W - MARGIN, y, C_RULE, 0.6);
    };

    // 表头可能有 N 行，翻页时整组重画
    const headerLayouts =
      headerRows > 0 && rows.length > headerRows
        ? Array.from({ length: headerRows }, (_, i) => layoutRow(i))
        : [];
    const headerHeight = headerLayouts.reduce((n, l) => n + l.rowH, 0);

    for (let r = 0; r < rows.length; r++) {
      const layout = layoutRow(r);
      // 表头之后的行才需要给重复表头预留高度
      const need = layout.rowH + 2 + (r >= headerRows ? headerHeight : 0);
      if (y - need < MARGIN) {
        newPage();
        // 新页先重复整组表头
        if (r >= headerRows) for (const h of headerLayouts) paintRow(h);
      }
      paintRow(layout);
    }
    for (let c = 0; c <= cols; c++) {
      const x = MARGIN + c * colW;
      drawLine(x, y, x, y, C_RULE, 0.6);
    }
    y -= 12;
  };

  /**
   * 自研表格（sparrowTable）的 PDF 排版。
   *
   * 复用 drawTable 那套「等宽列 + 边框 + 折行」的绘制：先把格内块数组摊成行内节点，
   * 拼成一个 legacy 表格模型，再交给同一段代码画。
   * 局限：colspan 只影响列宽估算（按总列数等分），rowspan 不画跨行——合并效果在 PDF 里
   * 退化成「独占一格」，但**每个单元格的文字都在，不会丢**。
   */
  /**
   * 自研表格（sparrowTable）的 PDF 排版：带占位矩阵的真网格。
   *
   * 为什么不用 drawTable：它的模型是「每行等长、无跨行跨列」，colspan 会被当成多一格、
   * rowspan 干脆画不出来。这里自己排：
   * 1. 先按 rowspan/colspan 建占位矩阵，算出每个单元格的 (row, col, rowSpan, colSpan)
   * 2. 逐格算折行高度，撑开所在行（跨行格不足时把最后一行撑高）
   * 3. 画的时候**每个单元格画自己的矩形**——合并格内部的线自然不会出现
   */
  const drawSparrowTable = (block: ShareBlock) => {
    const model = parseSparrowTable({ data: (block.props ?? {}).data });
    if (!model) return;

    const totalCols = Math.max(1, columnCount(model));
    const cellPad = 4;
    const size = F_SMALL;
    const colW = CONTENT_W / totalCols;
    const lineH = size * 1.5;

    /** 单元格里的块 → 行内节点（图片降级成 [图片] 文字） */
    const toInline = (cell: { blocks: unknown[] }): unknown[] => {
      const out: unknown[] = [];
      for (const b of cell.blocks) {
        const blk = b as { content?: unknown; props?: { caption?: string; url?: string } };
        const inline = Array.isArray(blk.content) ? blk.content : [];
        if (inline.length > 0) out.push(...inline);
        else if (typeof blk.props?.url === "string") {
          out.push({ type: "text", text: blk.props.caption || "[图片]", styles: {} });
        }
      }
      return out;
    };

    // 落位与行高交给纯函数（见 lib/pdf/tableLayout.ts，那边有单测）
    const flat: { cell: { blocks: unknown[]; colspan: number; rowspan: number } }[] = [];
    for (const row of model.rows) for (const cell of row) flat.push({ cell });

    const layout = layoutTable({
      rows: model.rows.map((row) => row.map((c) => ({ colspan: c.colspan, rowspan: c.rowspan }))),
      totalCols,
      headerRows: model.headerRows,
      headerCols: model.headerCols,
      rowMinHeight: lineH + cellPad * 2,
      cellHeight: (placed) => {
        const cell = flat[placed.index]?.cell;
        if (!cell) return lineH + cellPad * 2;
        const width = colW * placed.colSpan - cellPad * 2;
        const lines = wrapAtoms(toAtoms(toInline(cell)), width, size, measure);
        return Math.max(1, lines.length) * lineH + cellPad * 2;
      },
    });

    // 整表放不下就翻页（跨页暂不重复表头，先保证内容不丢）
    if (y - layout.totalHeight < MARGIN) newPage();
    const tops = rowTops(layout.rowHeights, y);

    for (const placed of layout.cells) {
      const cell = flat[placed.index]?.cell;
      if (!cell) continue;
      const x = MARGIN + placed.col * colW;
      const top = tops[placed.row];
      let height = 0;
      for (let r = placed.row; r < placed.row + placed.rowSpan; r++) height += layout.rowHeights[r];
      const bottom = top - height;
      const right = x + colW * placed.colSpan;

      // 每格画自己的框：合并格内部自然没有线
      drawLine(x, top, right, top, C_RULE, 0.6);
      drawLine(x, bottom, right, bottom, C_RULE, 0.6);
      drawLine(x, top, x, bottom, C_RULE, 0.6);
      drawLine(right, top, right, bottom, C_RULE, 0.6);

      const width = colW * placed.colSpan - cellPad * 2;
      const lines = wrapAtoms(toAtoms(toInline(cell)), width, size, measure);
      let textY = top - cellPad - size;
      for (const line of lines) {
        drawAtoms(line.atoms, size, x + cellPad, textY);
        textY -= lineH;
      }
    }

    y = y - layout.totalHeight - 12;
  };

  /** 图片 */
  const drawMedia = async (block: ShareBlock) => {
    const props = block.props ?? {};
    const url = typeof props.url === "string" ? props.url : "";
    if (!url.startsWith("data:")) {
      drawParagraph([{ type: "text", text: `[附件] ${url}`, styles: {} }], { size: F_SMALL, color: C_MUTED });
      return;
    }
    const parsed = parseDataUrl(url);
    if (!parsed) return;
    if (parsed.mime.includes("svg")) {
      const png = await svgToPngBytes(url);
      if (!png) {
        drawParagraph([{ type: "text", text: `[图形] ${String(props.caption ?? "")}`, styles: {} }], {
          size: F_SMALL,
          color: C_MUTED,
        });
        return;
      }
      const svgMeta = await embedImage(png, "image/png");
      const w = CONTENT_W;
      const h = w * (svgMeta.height / svgMeta.width);
      ensure(h + 8);
      page.drawImage(svgMeta.img as never, { x: MARGIN, y: y - h, width: w, height: h });
      y -= h + 12;
      return;
    }
    if (!parsed.mime.includes("png") && !parsed.mime.includes("jpeg") && !parsed.mime.includes("jpg")) {
      drawParagraph([{ type: "text", text: `[附件] ${String(props.name ?? "文件")}`, styles: {} }], {
        size: F_SMALL,
        color: C_MUTED,
      });
      return;
    }
    const meta2 = await embedImage(parsed.bytes, parsed.mime);
    const maxW = CONTENT_W;
    const ratio = meta2.height / meta2.width;
    const w = maxW;
    const h = w * ratio;
    const startY = y;
    ensure(h + 8);
    page.drawImage(meta2.img as never, { x: MARGIN, y: y - h, width: w, height: h });
    y = startY - h - 6;
    const caption = typeof props.caption === "string" ? props.caption : "";
    if (caption) {
      y -= F_SMALL * 1.4;
      drawText(caption, MARGIN, y, { size: F_SMALL, color: C_MUTED });
      y -= 4;
    }
    y -= 8;
  };

  const walk = async (list: ShareBlock[], depth: number, ctx: Ctx) => {
    void ctx;
    for (const block of list) {
      const props = block.props ?? {};
      switch (block.type) {
        case "heading": {
          const level = Math.min(6, Math.max(1, Number(props.level ?? 1) || 1));
          const size = HEADING_SIZE[level] ?? F_BODY;
          const atoms = toAtoms(block.content);
          const lines = wrapAtoms(atoms, CONTENT_W, size, measure);
          y -= size * 0.7;
          for (const line of lines) {
            ensure(size * 1.5);
            y -= size * 1.35;
            drawAtoms(line.atoms.map((a) => ({ ...a, bold: true })), size, MARGIN, y);
          }
          y -= size * 0.35;
          break;
        }
        case "bulletListItem":
          drawParagraph(block.content, { indent: depth * 14, bullet: "·", size: F_BODY });
          break;
        case "numberedListItem":
          drawParagraph(block.content, { indent: depth * 14, bullet: "•", size: F_BODY });
          break;
        case "checkListItem":
          drawParagraph(block.content, {
            indent: depth * 14,
            bullet: props.checked === true ? "☑" : "☐",
            size: F_BODY,
          });
          break;
        case "quote":
          drawParagraph(block.content, { bar: true, indent: 10, color: C_MUTED });
          break;
        case "codeBlock":
          drawCode(block);
          break;
        case "table":
          drawTable(block);
          break;
        case "sparrowTable":
          // 自研表格在 P0 阶段还没有专门的排版器：先按「每行一段」的文字降级，
          // 保证导出**不丢内容**；真正的网格绘制留给 P1（见 docs/dev/07 十二节）。
          drawSparrowTable(block);
          break;
        case "image":
        case "drawing":
          await drawMedia(block);
          break;
        case "video":
        case "audio":
        case "file":
          drawParagraph(
            [{ type: "text", text: `[附件] ${String(props.name ?? props.caption ?? "文件")}`, styles: {} }],
            { size: F_SMALL, color: C_MUTED },
          );
          break;
        case "divider":
          ensure(14);
          y -= 8;
          drawLine(MARGIN, y, PAGE_W - MARGIN, y, C_RULE, 0.8);
          y -= 6;
          break;
        case "paragraph":
          drawParagraph(block.content, { indent: depth * 12 });
          break;
        default: {
          // 自定义块：标签 + 内容，保证信息不丢
          const label = CUSTOM_LABEL[block.type];
          const text = toAtoms(block.content).map((a) => a.text).join("").trim();
          if (label) {
            drawParagraph(
              [{ type: "text", text: `${label}：`, styles: { bold: true } }, { type: "text", text: text, styles: {} }],
              { size: F_BODY, indent: 10, color: C_MUTED },
            );
          } else if (text) {
            drawParagraph(block.content, { indent: depth * 12 });
          }
          break;
        }
      }
      if (block.children?.length) await walk(block.children, depth + 1, ctx);
    }
  };

  drawTitle();
  const ctx: Ctx = {
    page,
    y,
    newPage,
    ensure,
    drawText,
    measure,
    drawRect,
    drawLine,
    drawImage: async () => {},
    embedImage,
  };
  await walk(blocks, 0, ctx);
  return pdf.save();
}

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

export type { Draw };
