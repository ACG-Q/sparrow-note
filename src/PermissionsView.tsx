import { useCallback, useEffect, useMemo, useState } from "react";
import {
  effectiveState,
  pendingIds,
  permissionRows,
  probePermission,
  requestPermission,
  resultText,
  stateText,
  summarize,
  type PermissionId,
  type PermState,
} from "./lib/permissions";
import { currentPlatform, platformLabel } from "./lib/platform";
import { ProfilePage } from "./app/ProfileShell";
import s from "./SettingsView.module.css";

/**
 * 权限页：先把每一项的当前状态探出来，再让用户就地申请。
 *
 * 这一页只做两件事——**检测**和**发起申请**；系统层面的开关（Windows 隐私设置、
 * Android 应用权限页）不归这里管，被拒绝时给出去哪儿打开。
 */
export function PermissionsView({ onBack }: { onBack: () => void }) {
  const platform = currentPlatform();
  const rows = useMemo(() => permissionRows(platform), [platform]);

  /** 探测到的状态 */
  const [states, setStates] = useState<Partial<Record<PermissionId, PermState>>>({});
  /** 刚申请完的结果（每行就地显示，不用滚到底看提示） */
  const [results, setResults] = useState<Partial<Record<PermissionId, PermState>>>({});
  const [busy, setBusy] = useState<PermissionId | "all" | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [loadError, setLoadError] = useState("");

  const probeAll = useCallback(async () => {
    const next: Partial<Record<PermissionId, PermState>> = {};
    for (const r of rows) next[r.id] = await probePermission(r.id, platform);
    setStates(next);
    return next;
  }, [rows, platform]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const next: Partial<Record<PermissionId, PermState>> = {};
        for (const r of rows) next[r.id] = await probePermission(r.id, platform);
        if (alive) setStates(next);
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [rows, platform]);

  const summary = summarize(rows, states);
  const askable = pendingIds(rows, states);

  const ask = async (id: PermissionId) => {
    if (busy) return;
    setBusy(id);
    setResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const after = await requestPermission(id, platform);
      setStates((prev) => ({ ...prev, [id]: after }));
      setResults((prev) => ({ ...prev, [id]: after }));
    } catch (e) {
      setResults((prev) => ({ ...prev, [id]: "unknown" }));
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  /** 一次把「能申请、还没拿到」的都问一遍；被拒绝的不再自动重问 */
  const askAll = async () => {
    if (busy) return;
    const targets = pendingIds(rows, states);
    if (targets.length === 0) return;
    setBusy("all");
    setLoadError("");
    setProgress({ done: 0, total: targets.length });
    const fresh: Partial<Record<PermissionId, PermState>> = {};
    for (let i = 0; i < targets.length; i++) {
      const id = targets[i];
      try {
        fresh[id] = await requestPermission(id, platform);
      } catch {
        fresh[id] = "unknown";
      }
      setResults((prev) => ({ ...prev, [id]: fresh[id] }));
      setProgress({ done: i + 1, total: targets.length });
    }
    setStates((prev) => ({ ...prev, ...fresh }));
    setProgress(null);
    setBusy(null);
  };

  const recheck = async () => {
    if (busy) return;
    setBusy("all");
    try {
      await probeAll();
      setResults({});
    } finally {
      setBusy(null);
    }
  };

  return (
    <ProfilePage title="权限" marker={platformLabel(platform)} onBack={onBack}>

      <p className={s.permIntro}>
        麻雀记不需要账号，也不上传内容。下面这些能力要用时才申请；系统层面的开关不归这里管。
      </p>

      <div className={s.permSummary}>
        <div className={s.permSummaryText}>
          <span className={s.permSummaryMain}>
            {summary.pending > 0 ? `${summary.pending} 项待授权` : "该给的都给了"}
          </span>
          <span className={s.permSummaryMeta}>
            已允许 {summary.granted}
            {summary.blocked > 0 && ` · 被拒绝 ${summary.blocked}`}
            {summary.fixed > 0 && ` · 不适用 ${summary.fixed}`}
          </span>
        </div>
        <div className={s.permSummaryActions}>
          {askable.length > 0 && (
            <button
              type="button"
              className={`${s.permBtn} ${s.permBtnPrimary}`}
              onClick={() => void askAll()}
              disabled={busy !== null}
            >
              {busy === "all"
                ? progress
                  ? `申请中 ${progress.done}/${progress.total}`
                  : "申请中…"
                : `全部申请（${askable.length}）`}
            </button>
          )}
          <button
            type="button"
            className={`${s.permBtn} ${s.permBtnGhost}`}
            onClick={() => void recheck()}
            disabled={busy !== null}
          >
            重新检测
          </button>
        </div>
      </div>

      {loadError && <p className={s.permWarn}>检测出错：{loadError}</p>}

      <div className={s.permList}>
        {rows.map((r) => {
          const probed = states[r.id] ?? "unknown";
          const st = effectiveState(probed, r.canRequest);
          const result = results[r.id];
          const granted = st === "granted";
          const actionable = r.canRequest && !granted;
          return (
            <div key={r.id} className={s.permRow}>
              <div className={s.permHead}>
                <span className={s.permName}>{r.name}</span>
                <span className={permClass(st)}>{stateText(st)}</span>
              </div>
              <p className={s.permWhy}>{r.why}</p>
              <p className={s.permMeta}>{r.usedBy}</p>

              {/* 只在「还没拿到」的时候解释平台差异，拿到了就别再占地方 */}
              {!granted && st === "denied" && r.fixHint && (
                <p className={s.permFix}>去这里打开：{r.fixHint}</p>
              )}
              {!granted && st !== "denied" && r.note && <p className={s.permNote}>{r.note}</p>}

              {actionable && (
                <div className={s.permActions}>
                  <button
                    type="button"
                    className={`${s.permBtn} ${s.permBtnRow}`}
                    onClick={() => void ask(r.id)}
                    disabled={busy !== null}
                  >
                    {busy === r.id ? "申请中…" : st === "denied" ? "再试一次" : "申请权限"}
                  </button>
                </div>
              )}

              {result && (
                <p className={result === "granted" ? s.permResultOk : s.permResult}>{resultText(r.id, result)}</p>
              )}
            </div>
          );
        })}
      </div>

      <p className={s.permFoot}>
        被拒绝后系统通常不再弹窗。{platformLabel(platform)} 上可以到「设置 → 应用 → 麻雀记 → 权限」里改，
        改完回来点上面的「重新检测」。
      </p>
    </ProfilePage>
  );
}

function permClass(state: PermState): string {
  if (state === "granted") return `${s.permState} ${s.permOk}`;
  if (state === "denied") return `${s.permState} ${s.permBad}`;
  if (state === "unsupported") return `${s.permState} ${s.permMuted}`;
  return `${s.permState} ${s.permWait}`;
}
