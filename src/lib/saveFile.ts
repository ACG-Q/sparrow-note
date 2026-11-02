import { isTauriMobile } from "./platform";

/**
 * 文件保存的统一出口。
 *
 * 为什么不能一律用 `<a download>`：Android WebView 不支持下载 `blob:` 链接，
 * `a.click()` 既不产生文件、也不报错，界面只能"假装成功"。
 * 所以移动端改走系统「另存为」对话框（@tauri-apps/plugin-dialog 的 `save()`）
 * 拿到落点后再真正写盘（@tauri-apps/plugin-fs 的 `writeFile()`）。
 * 浏览器与桌面 WebView 保留原来的 `<a download>` 分支。
 *
 * 注意：安卓上 `save()` 返回的是 `content://` URI（SAF 的 ACTION_CREATE_DOCUMENT），
 * 不是文件路径。fs 插件认得这种 URL（ContentResolver 拿 fd），可以直接 writeFile。
 */

/** 一次保存的真实结果 */
export type SaveOutcome =
  | {
      status: "saved";
      /** 界面上展示的文件名 */
      name: string;
      /**
       * tauri：系统对话框选好落点并已写盘（确实落地了）；
       * browser：`<a download>` 已触发，浏览器开始下载（无法进一步确认）。
       */
      via: "tauri" | "browser";
    }
  | { status: "cancelled" };

/** 当前是否走 Tauri 移动端的系统保存链路（安卓 / iOS 的 WebView） */
export function usesSystemSave(): boolean {
  return isTauriMobile();
}

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  md: "text/markdown",
  txt: "text/plain",
  zip: "application/zip",
  json: "application/json",
  csv: "text/csv",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  sparrow: "application/octet-stream",
};

function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export function mimeOf(name: string): string {
  return MIME_BY_EXT[extOf(name)] ?? "application/octet-stream";
}

/** 安卓的 DocumentsUI 靠扩展名推断 MIME，给个过滤项能让「另存为」默认类型正确 */
function dialogFilters(name: string): { name: string; extensions: string[] }[] {
  const ext = extOf(name);
  return ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : [];
}

/**
 * 从系统对话框返回的路径/URI 里取出给人看的文件名。
 * 安卓拿到的是 `content://…/document/primary%3ADownload%2F标题.md` 这类地址，
 * 解不出来就退回我们建议的文件名。
 */
export function displayNameOf(path: string, fallback: string): string {
  const cut = path.split(/[?#]/)[0];
  let decoded = cut;
  try {
    decoded = decodeURIComponent(cut);
  } catch {
    /* 不是合法转义就按原样用 */
  }
  const tail = decoded.split(/[/\\:]/).pop() ?? "";
  return /\.[a-z0-9]{1,8}$/i.test(tail) ? tail : fallback;
}

/** 数据 URL → 字节；长图动辄几 MB，不用 fetch 免得再走一遍网络栈 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("不是合法的 data URL");
  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (!meta.includes(";base64")) return new TextEncoder().encode(decodeURIComponent(body));

  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function blobOf(bytes: Uint8Array, mime: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type: mime });
}

/** 浏览器 / 桌面 WebView 的下载分支：造一个临时链接点一下 */
function downloadUrl(url: string, name: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadBlobUrl(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, name);
  // 下载是异步的，立刻回收会让部分浏览器拿不到内容
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 移动端：弹系统「另存为」，用户选好落点后写盘。
 * 取消时返回 cancelled（不能当成功），写盘失败则抛出——调用方必须如实提示。
 */
async function writeWithSystemDialog(
  bytes: Uint8Array,
  name: string,
): Promise<SaveOutcome> {
  // 按需加载：浏览器里根本不会走到这里，别把这俩插件塞进首屏
  const [dialog, fs] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/plugin-fs"),
  ]);
  const path = await dialog.save({ defaultPath: name, filters: dialogFilters(name) });
  // 用户点了返回 / 取消：没有文件落地，如实返回取消
  if (!path) return { status: "cancelled" };
  await fs.writeFile(path, bytes);
  return { status: "saved", name: displayNameOf(path, name), via: "tauri" };
}

/** 保存二进制内容：移动端走系统对话框，其余走 <a download> */
export async function saveBytesAs(
  bytes: Uint8Array,
  name: string,
  mime: string = mimeOf(name),
): Promise<SaveOutcome> {
  if (usesSystemSave()) return writeWithSystemDialog(bytes, name);
  downloadBlobUrl(blobOf(bytes, mime), name);
  return { status: "saved", name, via: "browser" };
}

/** 保存一个 Blob（Markdown / PDF / zip 都走这里） */
export async function saveBlobAs(blob: Blob, name: string): Promise<SaveOutcome> {
  if (!usesSystemSave()) {
    downloadBlobUrl(blob, name);
    return { status: "saved", name, via: "browser" };
  }
  return writeWithSystemDialog(new Uint8Array(await blob.arrayBuffer()), name);
}

/** 保存 data URL（长图导出拿到的就是它，几 MB 的 base64 不适合再转 Blob） */
export async function saveDataUrlAs(dataUrl: string, name: string): Promise<SaveOutcome> {
  if (usesSystemSave()) return writeWithSystemDialog(dataUrlToBytes(dataUrl), name);
  downloadUrl(dataUrl, name);
  return { status: "saved", name, via: "browser" };
}

/** 把失败原因收成一行，给提示条用 */
export function saveErrorText(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const oneLine = raw.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 60)}…` : oneLine || "未知错误";
}
