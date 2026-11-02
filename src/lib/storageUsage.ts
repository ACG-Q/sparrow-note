import type { NoteDoc } from "../db/notes";
import { createAssetSink } from "./package/assets";
import { noteToCanonical } from "./package/blocksFromNote";

/**
 * 本机占用估算。
 *
 * 口径和导出备份一致：用具名附件的那套转换（`noteToCanonical` + `AssetSink`）把图片、
 * 视频、语音、手绘的字节都收进 sink，正文则按 JSON 长度粗略算。
 * 不重新发明一套「块里哪些字段是附件」的规则——那种规则一定会和导出慢慢跑偏。
 */
export type StorageUsage = {
  /** 笔记篇数 */
  notes: number;
  /** 附件个数（内容相同算一个） */
  assets: number;
  /** 附件原始字节数 */
  assetBytes: number;
  /** 正文（标题 + 块 JSON）的字节数，压缩后落库会小一些 */
  textBytes: number;
  /** 合计 */
  totalBytes: number;
};

export const EMPTY_USAGE: StorageUsage = {
  notes: 0,
  assets: 0,
  assetBytes: 0,
  textBytes: 0,
  totalBytes: 0,
};

export async function estimateUsage(notes: NoteDoc[]): Promise<StorageUsage> {
  const sink = createAssetSink();
  let textBytes = 0;
  for (const note of notes) {
    await noteToCanonical(note, sink);
    textBytes += new TextEncoder().encode(JSON.stringify(note.blocks)).length;
    textBytes += new TextEncoder().encode(note.title).length;
  }
  let assetBytes = 0;
  for (const asset of sink.files.values()) assetBytes += asset.bytes.length;
  return {
    notes: notes.length,
    assets: sink.files.size,
    assetBytes,
    textBytes,
    totalBytes: assetBytes + textBytes,
  };
}

/** 字节 → 人看得懂的大小；小于 1 KB 就按 B 说 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}
