/** 字节层工具：base64 / data URL / MIME 后缀 / sha256。 */

// ---------- 字节工具 ----------

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/wav": "wav",
  "audio/webm": "weba",
  "audio/ogg": "ogg",
  "application/pdf": "pdf",
};

const EXT_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXT).map(([mime, ext]) => [ext, mime]),
);

export function extForMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? "bin";
}

export function mimeForExt(ext: string): string {
  return EXT_MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export type DataUrlParts = { mime: string; bytes: Uint8Array };

export function parseDataUrl(url: string): DataUrlParts | null {
  if (!url.startsWith("data:")) return null;
  const comma = url.indexOf(",");
  if (comma < 0) return null;
  const header = url.slice(5, comma);
  const body = url.slice(comma + 1);
  const [mime, ...params] = header.split(";");
  const type = mime || "application/octet-stream";
  // 兼容 data:image/svg+xml;utf8,<svg…> 这种非 base64 的写法
  if (params.some((p) => p.toLowerCase() === "base64")) {
    return { mime: type, bytes: base64ToBytes(body) };
  }
  try {
    return { mime: type, bytes: new TextEncoder().encode(decodeURIComponent(body)) };
  } catch {
    return null;
  }
}

export function toDataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // ArrayBufferLike 可能是 SharedArrayBuffer，digest 只收 ArrayBuffer 视图，先拷贝成独立缓冲
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
