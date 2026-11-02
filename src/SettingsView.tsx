import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoteDoc } from "./db/notes";
import { clearAllNotes, putNote } from "./db/notes";
import { setSetting, useSettings } from "./lib/settings";
import { MAP_PROVIDERS } from "./lib/mapProviders";
import {
  canPickAnyDir,
  getStorageStatus,
  moveDataDir,
  pickDataDir,
  requestAllFilesAccess,
  restartApp,
  storageKindText,
  type StorageStatus,
} from "./lib/storageInfo";
import { estimateUsage, formatBytes, EMPTY_USAGE, type StorageUsage } from "./lib/storageUsage";
import {
  backupOverview,
  backupsAvailable,
  runBackup,
  type BackupOverview,
} from "./lib/backups";
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
import { saveBlobAs, saveErrorText } from "./lib/saveFile";
import { confirmAction } from "./lib/confirm";
import { currentPlatform, isMobile, platformLabel } from "./lib/platform";
import { ProfilePage } from "./app/ProfileShell";
import s from "./SettingsView.module.css";

type PendingImport = { result: Extract<ReadPackageResult, { ok: true }>; name: string; size: number };

function fmtSize(bytes: number): string {
  return formatBytes(bytes);
}

/** 时间戳 → 「10-31 20:30」，跨年再带上年份 */
export function backupTimeText(at: number | null, now = new Date()): string {
  if (!at) return "还没有";
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = `${sameYear ? "" : `${d.getFullYear()}-`}${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return `${date} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Seg<T extends string | number>({
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
          key={String(o.key)}
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

  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [usage, setUsage] = useState<StorageUsage>(EMPTY_USAGE);
  const [overview, setOverview] = useState<BackupOverview | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  /** 读库时跳过的坏记录条数（仅桌面 SQLite 会 > 0） */
  const [corrupt, setCorrupt] = useState(0);
  const [copiedPath, setCopiedPath] = useState(false);

  const canBackup = useMemo(() => backupsAvailable(), []);

  const refreshStorage = useCallback(async () => {
    const [status, backup] = await Promise.all([getStorageStatus(), backupOverview()]);
    setStorage(status);
    setOverview(backup);
  }, []);

  useEffect(() => {
    let alive = true;
    setCorrupt(getCorruptRowCount());
    void (async () => {
      const [status, backup] = await Promise.all([getStorageStatus(), backupOverview()]);
      if (!alive) return;
      setStorage(status);
      setOverview(backup);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 用量跟着笔记走：导入 / 清空之后要重新算
  useEffect(() => {
    let alive = true;
    void estimateUsage(notes).then((u) => {
      if (alive) setUsage(u);
    });
    return () => {
      alive = false;
    };
  }, [notes]);

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

  /**
   * 换数据位置：复制快照 → 记配置 → 重启/退出。
   * 目标位置已有旧库时会再问一次——旧库改名留档，不直接删。
   */
  const switchDataDir = async (dir: string, label: string) => {
    const restartText = isMobile(currentPlatform())
      ? "应用会退出，重新打开后生效"
      : "然后重启应用";
    const ok = await confirmAction(
      `会把当前数据复制到「${label}」：\n${dir}\n${restartText}。原数据库保留在原位置，随时可以改回来。`,
      { title: "更换数据位置", okLabel: "复制并继续", cancelLabel: "取消" },
    );
    if (!ok) return;

    setBusy(true);
    setMsg("正在复制数据…");
    let result = await moveDataDir(dir);

    if (!result.ok && result.needsConfirm) {
      const when = result.oldModified ? new Date(result.oldModified).toLocaleString() : "未知时间";
      const again = await confirmAction(
        `「${label}」里已有一份旧数据（${fmtSize(result.oldBytes)}，${when}）。\n` +
          `继续的话，旧库会被改名成 notes.db.bak-… 留在那儿，再把当前数据写进去。`,
        { title: "这个位置已有旧数据", okLabel: "保留旧库并覆盖", cancelLabel: "取消" },
      );
      if (!again) {
        setBusy(false);
        setMsg("已取消，没有改动任何数据");
        return;
      }
      result = await moveDataDir(dir, true);
    }

    if (!result.ok) {
      setMsg(`更换失败：${result.reason}`);
      setBusy(false);
      return;
    }
    setMsg(`已复制到「${label}」，${restartText}…`);
    await restartApp();
  };

  /** 挑一个目录：桌面用系统选择器，安卓用自研插件（要「所有文件访问」） */
  const changeDataDir = async () => {
    const picked = await pickDataDir();
    if (!picked.ok) {
      if (!picked.cancelled) setMsg(picked.reason);
      return;
    }
    if (!picked.allFiles) {
      const go = await confirmAction(
        "安卓要把数据写到「内部存储 / 存储卡」里自己挑的文件夹，需要先给它「所有文件访问」权限。\n" +
          "现在去系统设置里打开吗？打开后回来再点一次「选择位置…」即可。",
        { title: "需要文件访问权限", okLabel: "去打开", cancelLabel: "取消" },
      );
      if (!go) return;
      await requestAllFilesAccess();
      setMsg("去系统设置里把「所有文件访问」打开，然后回来再选一次位置");
      return;
    }
    await switchDataDir(picked.path, "自定义位置");
  };

  const backToDefaultDir = async () => {
    if (!storage) return;
    await switchDataDir(storage.defaultDir, "默认位置");
  };

  const backupNow = async () => {
    if (backingUp) return;
    setBackingUp(true);
    setMsg("");
    const result = await runBackup(notes, { keep: settings.backupKeep });
    if (result.ok) {
      setSetting("lastBackupAt", result.at);
      setMsg(`已备份：${result.name}（${fmtSize(result.bytes)}）`);
      await refreshStorage();
    } else {
      setMsg(`备份失败：${result.reason}`);
    }
    setBackingUp(false);
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
      // 移动端会弹系统「另存为」：取消或写盘失败都不能再报「已导出」
      const outcome = await saveBlobAs(bytesToBlob(built.bytes), suggestFileName());
      if (outcome.status === "cancelled") {
        setMsg("已取消导出");
        return;
      }
      const done = textOnly
        ? `已导出仅文字备份（${built.format.counts.notes} 篇，不含附件）`
        : `已导出 ${built.format.counts.notes} 篇 · ${built.format.counts.assets} 个附件`;
      setMsg(outcome.via === "tauri" ? `${done}：${outcome.name}` : done);
    } catch (e) {
      setMsg(`导出失败：${saveErrorText(e)}`);
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
        // 备份先真的存下来；用户取消就当作没备份，别在提示里谎报
        const backupOutcome = await saveBlobAs(
          bytesToBlob(before.bytes),
          `backup-before-import-${stamp}.sparrow`,
        );
        backedUp = backupOutcome.status === "saved";
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
    if (
      !(await confirmAction("确定清空全部笔记？此操作不可撤销，建议先导出备份。", {
        title: "清空全部数据",
        okLabel: "清空",
        cancelLabel: "取消",
      }))
    ) {
      return;
    }
    await clearAllNotes();
    onDataCleared();
    setMsg("已清空全部数据");
  };

  return (
    <ProfilePage
      title="设置"
      marker={platformLabel(currentPlatform())}
      onBack={onBack}
    >
      {corrupt > 0 && (
        <p className={s.corruptNote}>
          有 {corrupt} 条记录读不出来（数据格式坏了），已跳过以免影响其它笔记。建议先导出一份备份再排查。
        </p>
      )}

      {/* ---------- 数据与存储 ---------- */}
      <section className={s.block}>
        <h2 className={s.bh}>数据与存储</h2>

        <div className={s.usageRow}>
          <span className={s.usageMain}>
            {usage.notes} 篇笔记 · {usage.assets} 个附件
          </span>
          <span className={s.usageMeta}>
            正文 {fmtSize(usage.textBytes)} · 附件 {fmtSize(usage.assetBytes)} · 合计{" "}
            {fmtSize(usage.totalBytes)}
          </span>
        </div>

        <div className={s.pathRow}>
          <span className={s.pathLabel}>数据库</span>
          <code className={s.pathValue}>{storage ? storage.path : "读取中…"}</code>
          <button type="button" className={s.copyBtn} onClick={() => void copyPath()} disabled={!storage}>
            {copiedPath ? "已复制" : "复制路径"}
          </button>
        </div>
        {storage && (
          <p className={s.pathNote}>
            {storageKindText(storage.kind)} · 占用 {fmtSize(storage.sizeBytes)}
            {storage.kind === "indexeddb" ? "；数据由浏览器托管" : ""}
          </p>
        )}

        {/* 存放位置：移动端两个真目录二选一；桌面端还能自己挑 */}
        {storage && storage.options.length > 0 && (
          <div className={s.placeBlock}>
            <div className={s.row}>
              <span className={s.rowLabel}>存放位置</span>
              <div className={s.placeList}>
                {storage.options.map((opt) => {
                  const active = opt.path === storage.dir;
                  return (
                    <button
                      key={opt.path}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={active ? `${s.placeBtn} ${s.placeOn}` : s.placeBtn}
                      onClick={() => {
                        if (!active) void switchDataDir(opt.path, opt.label);
                      }}
                      disabled={busy || active}
                    >
                      <span className={s.placeLabel}>{opt.label}</span>
                      <span className={s.placeHint}>{active ? "当前使用中" : opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {canPickAnyDir() && (
              <div className={s.acts}>
                <button type="button" onClick={() => void changeDataDir()} disabled={busy}>
                  选择位置…
                </button>
                {storage.isCustom && (
                  <button type="button" onClick={() => void backToDefaultDir()} disabled={busy}>
                    恢复默认位置
                  </button>
                )}
              </div>
            )}
            {storage.canChoose && !canPickAnyDir() && (
              <div className={s.acts}>
                {storage.isCustom && (
                  <button type="button" onClick={() => void backToDefaultDir()} disabled={busy}>
                    恢复默认位置
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 自动备份 */}
        <div className={s.backupBlock}>
          <div className={s.backupHead}>
            <button
              type="button"
              role="checkbox"
              aria-checked={settings.autoBackup}
              aria-label="自动备份"
              className={settings.autoBackup ? `${s.kindBox} ${s.kindBoxOn}` : s.kindBox}
              onClick={() => setSetting("autoBackup", !settings.autoBackup)}
              disabled={!canBackup}
            >
              {settings.autoBackup ? "✓" : ""}
            </button>
            <span className={s.backupText}>
              <span className={s.backupLabel}>自动备份</span>
              <span className={s.backupHint}>
                {canBackup ? "备份存在应用数据目录的 backups/ 里，不需要额外权限" : "浏览器里没有可写的本地目录"}
              </span>
            </span>
          </div>

          {settings.autoBackup && canBackup && (
            <>
              <div className={s.row}>
                <span className={s.rowLabel}>频率</span>
                <Seg
                  label="自动备份频率"
                  options={[
                    { key: "launch", label: "每次启动" },
                    { key: "daily", label: "每天" },
                    { key: "weekly", label: "每周" },
                  ]}
                  value={settings.backupInterval}
                  onChange={(v) => setSetting("backupInterval", v)}
                />
              </div>
              <div className={s.row}>
                <span className={s.rowLabel}>保留</span>
                <Seg
                  label="备份保留份数"
                  options={[
                    { key: 3, label: "3 份" },
                    { key: 5, label: "5 份" },
                    { key: 10, label: "10 份" },
                  ]}
                  value={settings.backupKeep}
                  onChange={(v) => setSetting("backupKeep", v)}
                />
              </div>
            </>
          )}

          <p className={s.backupMeta}>
            上次 {backupTimeText(overview?.lastAt ?? settings.lastBackupAt)}
            {canBackup
              ? ` · 现有 ${overview?.count ?? 0} 份${overview && overview.lastBytes > 0 ? ` · 最近 ${fmtSize(overview.lastBytes)}` : ""}`
              : ""}
          </p>

          {canBackup && (
            <div className={s.acts}>
              <button type="button" onClick={() => void backupNow()} disabled={busy || backingUp}>
                {backingUp ? "备份中…" : "立即备份"}
              </button>
            </div>
          )}
        </div>

        {/* 导入导出 */}
        <div className={s.subGroup}>
          <h3 className={s.subHead}>导入导出</h3>
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
              // 安卓的 DocumentsUI 按 MIME 过滤：`.sparrow` 这种自家扩展名会被识别成
              // application/octet-stream，不写进去它就把自己的备份文件显示成灰色、点不动。
              accept=".sparrow,.zip,application/zip,application/octet-stream"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickFile(f);
                e.target.value = "";
              }}
            />
          </div>
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

        {/* 危险操作单独成组，不和应用日常用的按钮挤在一起 */}
        <div className={s.subGroup}>
          <h3 className={s.subHead}>危险操作</h3>
          <div className={s.acts}>
            <button type="button" className={s.danger} onClick={() => void clearAll()} disabled={busy}>
              清空全部
            </button>
          </div>
          <p className={s.dangerHint}>清空后不可撤销，建议先「立即备份」或「导出备份」。</p>
        </div>

        {msg && <p className={s.status}>{msg}</p>}
      </section>

      {/* ---------- 地图 ---------- */}
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
                settings.mapProvider === p.id ? `${s.provider} ${s.providerOn}` : s.provider
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

      <p className={s.footNote}>
        笔记正文和附件都在本机，自动备份也只写本机目录，不会上传。换位置或换手机之前，先「导出备份」带走一份。
      </p>
    </ProfilePage>
  );
}
