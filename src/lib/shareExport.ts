import { strToU8, zipSync } from "fflate";
import { imageFileName, partFileName, saveImageAs } from "./download";
import { saveBlobAs, type SaveOutcome } from "./saveFile";
import { markdownFileName, type MarkdownBundle, type ShareBlock } from "./share";
import fontUrl from "../assets/fonts/sparrow-sans-sc.ttf?url";
import boldFontUrl from "../assets/fonts/sparrow-sans-sc-bold.ttf?url";

/**
 * 分享导出：Markdown（单文件 / zip）、PDF、长图。
 * 全部在浏览器里生成，不依赖系统打印对话框——手机上也能用。
 */

/** 收集页面上所有样式表规则（CSS Modules 的类名在克隆节点里是一样的） */
export function collectStyles(): string {
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) chunks.push(rule.cssText);
    } catch {
      /* 跨域样式表读不到，跳过 */
    }
  }
  return chunks.join("\n");
}

/** 把 :root 上的 CSS 变量抄到指定选择器：SVG 里没有 :root 可匹配 */
export function variablesCss(selector: string): string {
  const cs = getComputedStyle(document.documentElement);
  const vars: string[] = [];
  for (const name of Array.from(cs)) {
    if (!name.startsWith("--")) continue;
    const value = cs.getPropertyValue(name).trim();
    if (value) vars.push(`${name}: ${value};`);
  }
  return `${selector} { ${vars.join(" ")} }`;
}

const ROOT_ID = "sparrow-shot-root";

/**
 * canvas 的像素高度安全上限。Chrome 大约 32767px，接近上限就会变黑图或被截断，
 * 这里留出一点余量；超过它就必须拆图（长图）或逐页渲染（PDF）。
 */
export const MAX_CANVAS_HEIGHT = 30000;

/** 拆图时相邻两张的重叠高度（CSS 像素）：够盖住一行字，又不至于重复太多内容 */
const SLICE_OVERLAP = 24;

/** 整篇内容渲染出来的一张位图，还没落到 canvas 上 */
type NodeSnapshot = {
  img: HTMLImageElement;
  /** CSS 像素宽（含左右内边距） */
  width: number;
  /** CSS 像素高（整篇内容） */
  height: number;
  /** 纸色：canvas 底色，免得 PNG 透明处显黑 */
  bg: string;
};

/** 克隆 DOM、拼成 SVG、再解码成一张位图：单张、拆图、PDF 都基于它 */
async function renderNodeSnapshot(
  node: HTMLElement,
  opts: { width?: number; padding?: number } = {},
): Promise<NodeSnapshot> {
  const width = Math.max(320, Math.round(opts.width ?? Math.min(760, node.scrollWidth || 760)));
  const padding = opts.padding ?? 28;

  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.width = `${width}px`;
  clone.style.maxWidth = "none";
  clone.style.height = "auto";
  clone.style.overflow = "visible";
  clone.style.boxShadow = "none";

  const bodyCs = getComputedStyle(document.body);
  const bg = bodyCs.backgroundColor || "#f5f1e8";
  const fg = bodyCs.color || "#191713";

  const holder = document.createElement("div");
  holder.id = ROOT_ID;
  holder.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  holder.style.cssText = [
    `width:${width + padding * 2}px`,
    `background:${bg}`,
    `color:${fg}`,
    "box-sizing:border-box",
    `padding:${padding}px`,
    `font-family:${bodyCs.fontFamily}`,
    `font-size:${bodyCs.fontSize}`,
    `line-height:${bodyCs.lineHeight}`,
  ].join(";");
  holder.appendChild(clone);

  const style = document.createElement("style");
  style.textContent = `${collectStyles()}\n${variablesCss(`#${ROOT_ID}`)}`;
  holder.prepend(style);

  const totalWidth = width + padding * 2;
  const totalHeight = Math.max(200, holder.scrollHeight || (node.scrollHeight || 600) + padding * 2);
  const xhtml = new XMLSerializer().serializeToString(holder);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}">` +
    `<foreignObject x="0" y="0" width="${totalWidth}" height="${totalHeight}">${xhtml}</foreignObject></svg>`;

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("内容渲染失败"));
    el.src = url;
  });

  return { img, width: totalWidth, height: totalHeight, bg };
}

/**
 * 把位图里的一段（CSS 像素）画成 canvas。
 * y=0 且 height 为整篇高度时，走的就是原来的整张绘制路径，像素结果不变。
 */
function paintSnapshot(
  snap: NodeSnapshot,
  y: number,
  height: number,
  scale: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(snap.width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.fillStyle = snap.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  if (y === 0 && height === snap.height) {
    ctx.drawImage(snap.img, 0, 0, snap.width, height);
  } else {
    ctx.drawImage(snap.img, 0, y, snap.width, height, 0, 0, snap.width, height);
  }
  return canvas;
}

/** 一张图覆盖的原文区域（CSS 像素） */
export type ShotSlice = { y: number; height: number };

/**
 * 按 canvas 高度上限把整篇切成若干段：
 * 每段尽量填满 `maxPx`，只有最后一段可能短；相邻两段留 `SLICE_OVERLAP` 重叠，
 * 免得正好把一行字腰斩。单张放得下时只返回一段（y=0、整篇高度）。
 */
export function planShotSlices(
  cssHeight: number,
  scale: number,
  maxPx: number = MAX_CANVAS_HEIGHT,
): ShotSlice[] {
  const total = Math.max(1, Math.round(cssHeight));
  // 一张最多能装多少 CSS 像素高；向下取整保证 height * scale 不越过上限
  const sliceCss = Math.max(1, Math.floor(maxPx / scale));
  if (total <= sliceCss) return [{ y: 0, height: total }];

  const out: ShotSlice[] = [];
  let y = 0;
  while (y < total) {
    const height = Math.min(sliceCss, total - y);
    out.push({ y, height });
    if (y + height >= total) break;
    y += Math.max(1, height - SLICE_OVERLAP);
  }
  return out;
}

/** 把节点排成一张位图：克隆 DOM，把整站样式抄进 SVG 的 foreignObject */
export async function nodeToCanvas(
  node: HTMLElement,
  opts: { width?: number; scale?: number; padding?: number } = {},
): Promise<HTMLCanvasElement> {
  const snap = await renderNodeSnapshot(node, opts);
  // 整篇超过 canvas 上限时先压低倍率（最低 1），至少不会交出一张黑图
  const wantScale = opts.scale ?? 2;
  const scale = Math.min(wantScale, Math.max(1, MAX_CANVAS_HEIGHT / snap.height));
  return paintSnapshot(snap, 0, snap.height, scale);
}

/** 长图导出结果：给界面反馈用（张数、每张尺寸），也给验证脚本断言 */
export type PngExportResult = {
  /** 导出的图片张数；1 表示单张，行为与从前一致 */
  count: number;
  /** 每张图的最终文件名与像素尺寸 */
  files: { name: string; width: number; height: number }[];
  /** 每张图覆盖的原文区域（CSS 像素，相邻有重叠） */
  slices: ShotSlice[];
  /** 整篇内容高度（CSS 像素） */
  cssHeight: number;
  /** 实际使用的倍率 */
  scale: number;
  /**
   * 每张图的保存结果（与 files 同序）。移动端每张都要过一次「另存为」，
   * 用户中途取消时长度会短于 count——界面据此说清「存了几张、几张取消」。
   */
  saves: SaveOutcome[];
};

/**
 * 长图导出；width 是 CSS 像素宽度（内部再乘倍率）。
 * 整篇超过 canvas 上限时自动拆成多张「标题.png / 标题-2.png / 标题-3.png」，
 * 每张都尽量填满，切分带留少量重叠。
 *
 * 每张图都要等真的存好才算数：移动端用户取消一次就停下，不再继续弹对话框。
 */
export async function exportNodePng(
  node: HTMLElement,
  title: string,
  opts: { width?: number } = {},
): Promise<PngExportResult> {
  const snap = await renderNodeSnapshot(node, { width: opts.width });
  const scale = 2;
  const slices = planShotSlices(snap.height, scale);
  const base = title || "麻雀记";
  const files: PngExportResult["files"] = [];
  const saves: SaveOutcome[] = [];

  for (let i = 0; i < slices.length; i++) {
    const part = slices[i];
    const canvas = paintSnapshot(snap, part.y, part.height, scale);
    // 单张时文件名原样沿用；拆图才带序号
    const name = imageFileName(slices.length === 1 ? base : partFileName(base, i));
    const size = { name, width: canvas.width, height: canvas.height };
    const dataUrl = canvas.toDataURL("image/png");
    // 长图很占内存（一张几千 x 三万像素）：存完立刻释放，免得几张同时留在内存里
    canvas.width = 1;
    canvas.height = 1;
    const outcome = await saveImageAs(dataUrl, name);
    saves.push(outcome);
    files.push(size);
    // 取消后剩下的不再弹对话框（用户已经明确表示不存了）
    if (outcome.status === "cancelled") break;
  }

  return { count: slices.length, files, slices, cssHeight: snap.height, scale, saves };
}

let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

/** 中文字体子集按需加载（常规 1.9MB + 粗体 1.1MB），不拖慢首屏 */
async function loadPdfFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  if (fontCache) return fontCache;
  const [reg, bold] = await Promise.all([
    fetch(fontUrl).then((r) => {
      if (!r.ok) throw new Error("字体加载失败");
      return r.arrayBuffer();
    }),
    fetch(boldFontUrl).then((r) => (r.ok ? r.arrayBuffer() : null)),
  ]);
  const fonts = { regular: reg, bold: bold ?? reg };
  fontCache = fonts;
  return fonts;
}

/** 矢量文字 PDF：中文可选中、可搜索 */
export async function exportNotePdf(
  blocks: ShareBlock[],
  meta: { title: string; date?: string },
): Promise<SaveOutcome> {
  const { buildNotePdf } = await import("./pdfDoc");
  const fonts = await loadPdfFonts();
  const bytes = await buildNotePdf(blocks, meta, fonts.regular, fonts.bold);
  return saveBlobAs(
    new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
    markdownFileName(meta.title, "pdf"),
  );
}

/** A4 纸张（pt）与页边距 */
const A4_W = 595.28;
const A4_H = 841.89;
const PAGE_MARGIN = 36;

/**
 * PDF：把长图按 A4 切页，用 pdf-lib 组装成真 PDF 文件。
 * 走系统打印虽然文字可选，但手机 WebView 基本不支持；
 * 这里宁可牺牲"可选中的文字"，换来一次点击就拿到文件。
 *
 * 整篇很长时不能先拼一张巨大的 canvas（会变黑图），所以：
 * 先压低倍率（最低 1），再按 A4 页高逐段从同一张位图上直接画页。
 */
export async function exportNodePdf(node: HTMLElement, title: string): Promise<SaveOutcome> {
  const snap = await renderNodeSnapshot(node);
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setTitle(title || "麻雀记");
  pdf.setCreator("麻雀记");

  const contentW = A4_W - PAGE_MARGIN * 2;
  const contentH = A4_H - PAGE_MARGIN * 2;
  // 一旦整篇高度超过 canvas 上限，倍率跟着降（最低 1，再低就糊得没法看了）
  const scale = Math.min(2, Math.max(1, MAX_CANVAS_HEIGHT / snap.height));
  // 一页能装下多少 CSS 像素的原文高度
  const sliceCss = Math.max(1, Math.floor((snap.width * contentH) / contentW));

  let offset = 0;
  let index = 0;
  while (offset < snap.height && index < 200) {
    const h = Math.min(sliceCss, snap.height - offset);
    const page = paintSnapshot(snap, offset, h, scale);

    const dataUrl = page.toDataURL("image/png");
    const bin = atob(dataUrl.split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // 页画布用完即放，长笔记几十页也不至于把内存撑爆
    page.width = 1;
    page.height = 1;

    const embedded = await pdf.embedPng(bytes);
    const drawH = (h * contentW) / snap.width;
    const p = pdf.addPage([A4_W, A4_H]);
    p.drawImage(embedded, {
      x: PAGE_MARGIN,
      y: A4_H - PAGE_MARGIN - drawH,
      width: contentW,
      height: drawH,
    });

    offset += h;
    index += 1;
  }

  const out = await pdf.save();
  return saveBlobAs(
    new Blob([out as unknown as BlobPart], { type: "application/pdf" }),
    markdownFileName(title, "pdf"),
  );
}

/** Markdown 单文件（附件内联 base64） */
export async function downloadMarkdownFile(markdown: string, title: string): Promise<SaveOutcome> {
  return saveBlobAs(
    new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    markdownFileName(title),
  );
}

/** Markdown 压缩包：正文 + assets/ 一起打包 */
export async function downloadMarkdownZip(
  bundle: MarkdownBundle,
  title: string,
): Promise<SaveOutcome> {
  const files: Record<string, Uint8Array> = {
    [markdownFileName(title)]: strToU8(bundle.markdown),
  };
  for (const asset of bundle.assets) files[asset.path] = asset.bytes;
  const zipped = zipSync(files, { level: 6 });
  return saveBlobAs(
    new Blob([zipped as unknown as BlobPart], { type: "application/zip" }),
    markdownFileName(title, "zip"),
  );
}

/** 走系统打印（矢量文字，桌面端质量最好） */
export function printNode(node: HTMLElement): void {
  const holder = document.createElement("div");
  holder.className = "sparrow-print-holder";
  holder.appendChild(node.cloneNode(true));
  document.body.appendChild(holder);
  document.documentElement.classList.add("sparrow-printing");

  const cleanup = () => {
    document.documentElement.classList.remove("sparrow-printing");
    holder.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // 有的 WebView 不派发 afterprint；打印对话框关闭后窗口会重新获得焦点
  window.addEventListener("focus", cleanup, { once: true });
  window.print();
  window.setTimeout(cleanup, 30000);
}
