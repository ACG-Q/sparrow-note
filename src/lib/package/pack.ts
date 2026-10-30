/** 打包：把规范化笔记 + 附件 zip 成 .sparrow 文件。 */
import { strFromU8, unzipSync, zip, type AsyncZippable } from "fflate";
import type { NoteDoc } from "../../db/notes";
import type { ImportReport, PackageFormat } from "./types";
import type { ImportMode } from "./types";
import { FORMAT_VERSION, PKG_SCHEMA } from "./types";
import { sha256Hex, toDataUrl, mimeForExt } from "./bytes";
import { createAssetSink } from "./assets";
import { noteToCanonical } from "./blocksFromNote";
import { validateNote } from "./validate";
import { canonicalNoteToNote } from "./blocksToNote";
import { MAX_PACKAGE_BYTES, MAX_PACKAGE_ENTRIES, MAX_UNPACKED_BYTES } from "./types";

// ---------- 打包 ----------

const README = [
  "这是「麻雀记」的备份包，本质是一个 zip。",
  "",
  "format.json   —— 包清单：格式版本、导出时间、每个文件的校验和",
  "notes/*.json  —— 每篇笔记一个文件，文件名是笔记 id",
  "assets/*      —— 图片、视频、音频、手绘、语音，文件名是内容哈希",
  "",
  "要恢复，直接用麻雀记的「导入备份」选择这个文件即可。",
].join("\n");

export type BuiltPackage = { bytes: Uint8Array; format: PackageFormat };

/** 笔记 id 直接当文件名，去掉可能破坏路径的字符 */
export function safeFileName(id: string): string {
  return id.replace(/[^\w.-]/g, "_") || `note-${Date.now()}`;
}

export async function buildPackage(
  notes: NoteDoc[],
  opts: { appVersion?: string; textOnly?: boolean; now?: Date } = {},
): Promise<BuiltPackage> {
  const sink = createAssetSink();
  const canonical = await Promise.all(notes.map((n) => noteToCanonical(n, sink)));

  const files: AsyncZippable = {};
  const index: PackageFormat["files"] = [];
  const encoder = new TextEncoder();

  const addJson = (path: string, value: unknown) => {
    const bytes = encoder.encode(JSON.stringify(value, null, 2));
    files[path] = [bytes, { level: 6 }];
    return bytes;
  };

  const noteEntries = await Promise.all(
    canonical.map(async (note) => ({ note, bytes: addJson(`notes/${safeFileName(note.id)}.json`, note) })),
  );
  const hashes = await Promise.all(noteEntries.map((e) => sha256Hex(e.bytes)));
  noteEntries.forEach((e, i) => {
    index.push({ path: `notes/${safeFileName(e.note.id)}.json`, bytes: e.bytes.length, sha256: hashes[i] });
  });

  if (!opts.textOnly) {
    for (const [id, asset] of sink.files) {
      files[`assets/${id}`] = [asset.bytes, { level: 0 }];
      index.push({ path: `assets/${id}`, bytes: asset.bytes.length, sha256: await sha256Hex(asset.bytes) });
    }
  }

  files["README.txt"] = [encoder.encode(README), { level: 6 }];

  const totalBytes = Object.values(files).reduce<number>(
    (sum, entry) => sum + (entry as [Uint8Array, unknown])[0].length,
    0,
  );

  const format: PackageFormat = {
    schema: PKG_SCHEMA,
    version: FORMAT_VERSION,
    createdAt: (opts.now ?? new Date()).toISOString(),
    app: { name: "麻雀记", version: opts.appVersion ?? "0.1.0" },
    counts: { notes: canonical.length, assets: opts.textOnly ? 0 : sink.files.size, bytes: totalBytes },
    files: index,
  };
  files["format.json"] = [encoder.encode(JSON.stringify(format, null, 2)), { level: 6 }];

  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)));
  });
  return { bytes, format };
}

// ---------- 解包 ----------

export type ReadPackageResult =
  | {
      ok: true;
      format: PackageFormat;
      notes: NoteDoc[];
      report: ImportReport;
    }
  | { ok: false; reason: string };

export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export type ReadPackageLimits = {
  maxEntries?: number;
  maxUnpackedBytes?: number;
  maxPackageBytes?: number;
};

export async function readPackage(
  file: File,
  opts: { mode?: ImportMode; limits?: ReadPackageLimits } = {},
): Promise<ReadPackageResult> {
  const maxPackageBytes = opts.limits?.maxPackageBytes ?? MAX_PACKAGE_BYTES;
  const maxEntries = opts.limits?.maxEntries ?? MAX_PACKAGE_ENTRIES;
  const maxUnpacked = opts.limits?.maxUnpackedBytes ?? MAX_UNPACKED_BYTES;
  if (file.size > maxPackageBytes) {
    return { ok: false, reason: `备份包超过 ${Math.round(maxPackageBytes / 1024 / 1024)}MB，不予导入` };
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeZip(buf)) return { ok: false, reason: "这不是麻雀记的备份包（不是 zip）" };

  // 解压前先设上限：既限制条目数，也限制累计解压体积（zip 炸弹防护）
  let entryCount = 0;
  let unpacked = 0;
  let tooBig: string | null = null;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buf, {
      filter: (f) => {
        if (tooBig) return false;
        entryCount += 1;
        if (entryCount > maxEntries) {
          tooBig = `文件数超过 ${maxEntries} 个`;
          return false;
        }
        unpacked += f.originalSize;
        if (unpacked > maxUnpacked) {
          tooBig = `解压后超过 ${Math.round(maxUnpacked / 1024 / 1024)}MB`;
          return false;
        }
        return true;
      },
    });
  } catch {
    return { ok: false, reason: "压缩包损坏，无法解压" };
  }
  if (tooBig) return { ok: false, reason: `备份包太大：${tooBig}` };

  const formatBytes = entries["format.json"];
  if (!formatBytes) return { ok: false, reason: "包里没有 format.json" };

  let format: PackageFormat;
  try {
    format = JSON.parse(strFromU8(formatBytes)) as PackageFormat;
  } catch {
    return { ok: false, reason: "format.json 不是合法 JSON" };
  }
  if (format.schema !== PKG_SCHEMA) return { ok: false, reason: "这不是麻雀记的备份包" };
  if (typeof format.version !== "number" || format.version > FORMAT_VERSION) {
    return { ok: false, reason: `备份包版本 ${String(format.version)} 太新，请先升级应用` };
  }

  const report: ImportReport = {
    total: 0,
    imported: 0,
    skipped: 0,
    failed: [],
    warnings: [],
    missingAssets: 0,
    unknownBlocks: 0,
  };

  // 校验每个在清单里的文件
  const bad = new Set<string>();
  for (const f of format.files ?? []) {
    const data = entries[f.path];
    if (!data) {
      bad.add(f.path);
      report.warnings.push({ file: f.path, reason: "清单里有，包里没有" });
      continue;
    }
    if (typeof f.sha256 === "string" && f.sha256) {
      const actual = await sha256Hex(data);
      if (actual !== f.sha256) {
        bad.add(f.path);
        report.failed.push({ file: f.path, reason: "校验和不匹配（文件被改动或损坏）" });
      }
    }
  }

  // 资产 -> data URL
  const assets = new Map<string, string>();
  for (const [path, data] of Object.entries(entries)) {
    if (!path.startsWith("assets/")) continue;
    if (bad.has(path)) continue;
    const id = path.slice("assets/".length);
    const ext = id.split(".").pop() ?? "bin";
    assets.set(id, toDataUrl(mimeForExt(ext), data));
  }

  const resolve = (asset: string): string | null => assets.get(asset) ?? null;

  const noteFiles = Object.keys(entries).filter((p) => p.startsWith("notes/") && p.endsWith(".json"));
  report.total = noteFiles.length;

  // 清单之外的文件（多拷进来的、手工塞的）不静默吃下
  const indexed = new Set((format.files ?? []).map((f) => f.path));
  indexed.add("format.json");
  indexed.add("README.txt");
  for (const path of Object.keys(entries)) {
    if (!indexed.has(path)) report.warnings.push({ file: path, reason: "不在清单里，已忽略" });
  }

  const notes: NoteDoc[] = [];
  const seen = new Set<string>();
  for (const path of noteFiles) {
    if (bad.has(path)) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(strFromU8(entries[path]));
    } catch {
      report.failed.push({ file: path, reason: "不是合法 JSON" });
      continue;
    }
    const check = validateNote(raw);
    if (!check.ok) {
      report.failed.push({ file: path, reason: check.reason });
      continue;
    }
    if (seen.has(check.note.id)) {
      report.warnings.push({ file: path, reason: "和另一篇用了同一个 id，已跳过" });
      continue;
    }
    seen.add(check.note.id);
    const restored = canonicalNoteToNote(check.note, resolve);
    report.missingAssets += restored.missing;
    report.unknownBlocks += restored.unknown;
    notes.push(restored.note);
  }

  const mode = opts.mode ?? "merge";
  // 与本地库的合并由调用方做（它才知道库里现有什么），这里只负责解析
  report.imported = 0;
  void mode;

  return { ok: true, format, notes, report };
}
