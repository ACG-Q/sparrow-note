import { useCallback, useEffect, useMemo, useState } from "react";
import {
  permissionRows,
  probePermission,
  requestPermission,
  stateText,
  type PermissionId,
  type PermState,
} from "./lib/permissions";
import { currentPlatform, platformLabel } from "./lib/platform";
import s from "./SettingsView.module.css";

export function PermissionsView({ onBack }: { onBack: () => void }) {
  const platform = currentPlatform();
  const rows = useMemo(() => permissionRows(platform), [platform]);
  const [states, setStates] = useState<Partial<Record<PermissionId, PermState>>>({});
  const [busy, setBusy] = useState<PermissionId | null>(null);
  const [flash, setFlash] = useState("");

  const refresh = useCallback(
    async (ids: PermissionId[]) => {
      const next: Partial<Record<PermissionId, PermState>> = {};
      for (const id of ids) next[id] = await probePermission(id, platform);
      setStates((prev) => ({ ...prev, ...next }));
    },
    [platform],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      const next: Partial<Record<PermissionId, PermState>> = {};
      for (const r of rows) next[r.id] = await probePermission(r.id, platform);
      if (alive) setStates(next);
    })();
    return () => {
      alive = false;
    };
  }, [rows, platform]);

  const ask = async (id: PermissionId) => {
    if (busy) return;
    setBusy(id);
    setFlash("");
    const after = await requestPermission(id, platform);
    setStates((prev) => ({ ...prev, [id]: after }));
    setFlash(
      after === "granted"
        ? "已获得授权。"
        : after === "denied"
          ? "被拒绝了。可以到系统设置里手动打开，回来再点「重新申请」。"
          : after === "unsupported"
            ? "这个平台走不通，换一种方式吧。"
            : "没有拿到明确结果，可以再试一次。",
    );
    setBusy(null);
  };

  return (
    <div className={s.page}>
      <div className={s.phead}>
        <button type="button" className={s.back} onClick={onBack}>
          ← 我的
        </button>
        <div className={s.pheadRow}>
          <h1>权限</h1>
          <span className={s.pn}>{platformLabel(platform)}</span>
        </div>
      </div>

      <p className={s.hintText}>
        麻雀记不需要账号，也不上传数据。下面是它在 <strong>{platformLabel(platform)}</strong>{" "}
        上可能用到的能力、当前状态，以及能不能在这里直接申请。
      </p>

      <div className={s.permList}>
        {rows.map((r) => {
          const state = states[r.id] ?? "unknown";
          return (
            <div key={r.id} className={s.permRow}>
              <div className={s.permHead}>
                <span className={s.permName}>{r.name}</span>
                <span className={permClass(state)}>{stateText(state)}</span>
              </div>
              <p className={s.permWhy}>{r.why}</p>
              <p className={s.permMeta}>用在：{r.usedBy}</p>
              {r.note && <p className={s.permNote}>{r.note}</p>}
              {state === "denied" && r.fixHint && <p className={s.permNote}>去这里打开：{r.fixHint}</p>}

              <div className={s.permActions}>
                {r.canRequest && state !== "granted" && state !== "unsupported" && (
                  <button
                    type="button"
                    className={s.permBtn}
                    onClick={() => void ask(r.id)}
                    disabled={busy !== null}
                  >
                    {busy === r.id ? "申请中…" : state === "denied" ? "重新申请" : "申请权限"}
                  </button>
                )}
                {(state === "granted" || !r.canRequest) && state !== "unsupported" && (
                  <button
                    type="button"
                    className={s.permBtnGhost}
                    onClick={() => void refresh([r.id])}
                    disabled={busy !== null}
                  >
                    重新检测
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {flash && <p className={s.permFlash}>{flash}</p>}

      <p className={s.hintText}>
        系统层面的开关（Windows 隐私设置、Android 应用权限等）不受本页控制；这里只做「检测 + 发起申请」。
      </p>
    </div>
  );
}

function permClass(state: PermState): string {
  if (state === "granted") return `${s.permState} ${s.permOk}`;
  if (state === "denied") return `${s.permState} ${s.permBad}`;
  return `${s.permState} ${s.permMuted}`;
}
