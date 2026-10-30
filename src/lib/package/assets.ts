/** 附件收集：把 data URL 去重后抽成独立文件，按内容哈希命名。 */
import { extForMime, parseDataUrl, sha256Hex } from "./bytes";

export type AssetSink = {
  seen: Map<string, string>;
  files: Map<string, { bytes: Uint8Array; mime: string }>;
};

export function createAssetSink(): AssetSink {
  return { seen: new Map(), files: new Map() };
}

/** 把 data URL 收进资产池，返回资产 id（去重）；不是 data URL 时返回 null */
async function putAsset(sink: AssetSink, url: string): Promise<string | null> {
  if (!url.startsWith("data:")) return null;
  const parts = parseDataUrl(url);
  if (!parts) return null;
  const hash = await sha256Hex(parts.bytes);
  const cached = sink.seen.get(hash);
  if (cached) return cached;
  const id = `${hash.slice(0, 16)}.${extForMime(parts.mime)}`;
  sink.seen.set(hash, id);
  sink.files.set(id, { bytes: parts.bytes, mime: parts.mime });
  return id;
}

/** 块映射要用它把附件塞进资产池 */
export { putAsset };
