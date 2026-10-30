import { useEffect, useRef, useState } from "react";
import type { NoteDoc } from "./db/notes";
import { clearAllNotes, putNote } from "./db/notes";
import { setSetting, useSettings } from "./lib/settings";
import { MAP_PROVIDERS } from "./lib/mapProviders";
import { getStorageInfo, type StorageInfo } from "./lib/storageInfo";
import { getCorruptRowCount } from "./db/sqlite";
import {
  buildPackage,
  bytesToBlob,
  mergeNotes,
  readPackage,
  suggestFileName,
  type ImportMode,
  type ImportReport,
  type ReadPackageResult,
} from "./lib/sparrowPackage";
import s from "./SettingsView.module.css";

type PendingImport = { result: Extract<ReadPackageResult, { ok: true }>; name: string; size: number };

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}


function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={s.seg} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={value === o.key ? `${s.segBtn} ${s.segOn}` : s.segBtn}
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsView({
  notes,
  onDataCleared,
  onBack,
}: {
  notes: NoteDoc[];
  onDataCleared: () => void;
  onBack: () => void;
}) {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  /** 读库时跳过的坏记录条数（仅桌面 SQLite 会 > 0） */
  const [corrupt, setCorrupt] = useState(0);
  const [copiedPath, setCopiedPath] = useState(false);

  useEffect(() => {
    let alive = true;
    setCorrupt(getCorruptRowCount());
    void getStorageInfo().then((info) => {
      if (alive) setStorage(info);
    });
    return () => {
      alive = false;
    };
  }, []);

  const copyPath = async () => {
    if (!storage) return;
    try {
      await navigator.clipboard.writeText(storage.path);
      setCopiedPath(true);
      window.setTimeout(() => setCopiedPath(false), 1500);
    } catch {
      setCopiedPath(false);
    }
  };
  const [mode, setMode] = useState<ImportMode>("merge");
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [backupFirst, setBackupFirst] = useState(true);

  const exportBackup = async (textOnly: boolean) => {
    setBusy(true);
    setMsg("");
    try {
      const built = await buildPackage(notes, { textOnly });
      downloadBlob(bytesToBlob(built.bytes), suggestFileName());
      setMsg(
        textOnly
          ? `已导出仅文字备份（${built.format.counts.notes} 篇，不含附件）`
          : `已导出 ${built.format.counts.notes} 篇 · ${built.format.counts.assets} 个附件`,
      );
    } catch (e) {
      setMsg(`导出失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (file: File) => {
    setBusy(true);
    setMsg("");
    setPending(null);
    setReport(null);
    try {
      const result = await readPackage(file);
      if (!result.ok) {
        setMsg(result.reason);
        return;
      }
      setPending({ result, name: file.name, size: file.size });
    } catch (e) {
      setMsg(`无法读取备份：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    let backedUp = false;
    try {
      const { toWrite, skipped } = mergeNotes(notes, pending.result.notes, mode);
      // 覆盖式导入是唯一会丢数据的操作，先落一份当前数据的备份
      if (backupFirst && toWrite.length > 0 && notes.length > 0) {
        const before = await buildPackage(notes);
        const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
        downloadBlob(bytesToBlob(before.bytes), `backup-before-import-${stamp}.sparrow`);
        backedUp = true;
      }
      for (const note of toWrite) await putNote(note);
      const done: ImportReport = {
        ...pending.result.report,
        imported: toWrite.length,
        skipped,
      };
      setReport(done);
      setPending(null);
      setShowDetail(done.failed.length > 0);
      onDataCleared();
      const parts = [`写入 ${toWrite.length} 篇`];
      if (skipped > 0) parts.push(`跳过 ${skipped} 篇（本地已有更新的版本）`);
      if (backedUp) parts.push("已先导出导入前的备份");
      setMsg(`导入完成：${parts.join("，")}`);
    } catch (e) {
      setMsg(`导入失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm("确定清空全部笔记？此操作不可撤销，建议先导出备份。")) return;
    await clearAllNotes();
    onDataCleared();
    setMsg("已清空全部数据");
  };

  return (
    <div className={s.page}>
      <header className={s.phead}>
        <button type="button" className={s.back} onClick={onBack} aria-label="返回我的">
          ← 我的
        </button>
        <div className={s.pheadRow}>
          <h1>设置</h1>
          <span className={s.pn}>本机</span>
        </div>
      </header>

      <section className={s.block}>
        <h2 className={s.bh}>存储</h2>
        <div className={s.pathRow}>
          <span className={s.pathLabel}>数据库</span>
          <code className={s.pathValue}>{storage ? storage.path : "读取中…"}</code>
          <button
            type="button"
            className={s.copyBtn}
            onClick={() => void copyPath()}
            disabled={!storage}
          >
            {copiedPath ? "已复制" : "复制路径"}
          </button>
        </div>
        {storage && (
          <p className={s.pathNote}>
            {storage.note}
            {storage.kind === "sqlite" &&
              " 开发版放在程序旁边；打包安装后放到系统用户数据目录。"}
          </p>
        )}
        {corrupt > 0 && (
          <p className={s.corruptNote}>
            有 {corrupt} 条记录读不出来（数据格式坏了），已跳过以免影响其它笔记。
            建议先导出一份备份再排查。
          </p>
        )}
      </section>

      <section className={s.block}>
        <h2 className={s.bh}>地图</h2>
        <p className={s.hintText}>
          位置块预览地图用的瓦片来源。现在只有高德，以后接别家会出现在这里。
        </p>
        <div className={s.providerList}>
          {MAP_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={
                settings.mapProvider === p.id
                  ? `${s.provider} ${s.providerOn}`
                  : s.provider
              }
              onClick={() => setSetting("mapProvider", p.id)}
            >
              <span className={s.providerMain}>
                <span className={s.providerName}>{p.label}</span>
                <span className={s.providerNote}>
                  {p.note ?? ""} 坐标系 {p.coordSystem === "gcj02" ? "GCJ-02" : "WGS-84"} · 最高 {p.maxZoom} 级
                </span>
              </span>
              <span className={s.providerMark} aria-hidden="true">
                {settings.mapProvider === p.id ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={s.block}>
        <h2 className={s.bh}>数据</h2>
        <div className={s.acts}>
          <button type="button" onClick={() => void exportBackup(false)} disabled={busy}>
            导出备份
          </button>
          <button type="button" onClick={() => void exportBackup(true)} disabled={busy}>
            导出仅文字
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
            导入备份
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".sparrow,.zip,application/zip"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pickFile(f);
              e.target.value = "";
            }}
          />
          <button type="button" className={s.danger} onClick={clearAll} disabled={busy}>
            清空全部
          </button>
        </div>

        {pending && (
          <div className={s.importBox}>
            <p className={s.importName}>{pending.name}</p>
            <p className={s.importMeta}>
              {pending.result.format.counts.notes} 篇 · {pending.result.format.counts.assets} 个附件 · 包{" "}
              {fmtSize(pending.size)}（解压后 {fmtSize(pending.result.format.counts.bytes)}）
              {pending.result.report.failed.length > 0
                ? ` · ${pending.result.report.failed.length} 篇有问题`
                : ""}
            </p>
            <div className={s.row}>
              <span className={s.rowLabel}>重复的笔记</span>
              <Seg
                label="导入模式"
                options={[
                  { key: "merge", label: "保留新的" },
                  { key: "overwrite", label: "以备份为准" },
                  { key: "fill", label: "只补空缺" },
                ]}
                value={mode}
                onChange={(v) => setMode(v)}
              />
            </div>
            <label className={s.checkRow}>
              <input
                type="checkbox"
                checked={backupFirst}
                onChange={(e) => setBackupFirst(e.target.checked)}
              />
              <span>导入前先导出当前数据的备份</span>
            </label>
            <div className={s.importActions}>
              <button type="button" className={s.primary} onClick={() => void confirmImport()} disabled={busy}>
                确认导入
              </button>
              <button type="button" onClick={() => setPending(null)} disabled={busy}>
                取消
              </button>
            </div>
          </div>
        )}

        {report && (
          <div className={s.report}>
            <p className={s.reportLine}>
              写入 {report.imported} 篇
              {report.skipped > 0 ? ` · 跳过 ${report.skipped} 篇` : ""}
              {report.failed.length > 0 ? ` · 失败 ${report.failed.length} 篇` : ""}
              {report.missingAssets > 0 ? ` · ${report.missingAssets} 个附件缺失` : ""}
              {report.unknownBlocks > 0 ? ` · ${report.unknownBlocks} 个未知块` : ""}
            </p>
            {report.failed.length > 0 && (
              <button type="button" className={s.detailBtn} onClick={() => setShowDetail((v) => !v)}>
                {showDetail ? "收起明细" : "查看明细"}
              </button>
            )}
            {showDetail && (
              <ul className={s.detailList}>
                {report.failed.map((f, i) => (
                  <li key={`f${i}`}>
                    {f.file}：{f.reason}
                  </li>
                ))}
                {report.warnings.map((w, i) => (
                  <li key={`w${i}`} className={s.detailWarn}>
                    {w.file}：{w.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {msg && <div className={s.msg}>{msg}</div>}
      </section>

    </div>
  );
}
