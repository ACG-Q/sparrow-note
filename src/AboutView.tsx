import { useEffect, useState } from "react";
import { APP_NAME, appVersion } from "./lib/appInfo";
import { currentPlatform, platformLabel } from "./lib/platform";
import {
  canSelfInstall,
  checkForUpdates,
  getSelectedSource,
  listUpdateSources,
  loadUpdateSettings,
  saveUpdateSettings,
  type UpdateCheckResult,
  type UpdateSettings,
} from "./lib/updates";
import { clearUpdateNotice, setUpdateNotice, useUpdateNotice } from "./lib/updateNotice";
import s from "./SettingsView.module.css";

function fmtTime(ts: number | null): string {
  if (!ts) return "还没检查过";
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 和设置页同一个分段控件（沿用其他页面的做法：页面内小工具不跨文件共享） */
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

export function AboutView({ onBack }: { onBack: () => void }) {
  const platform = currentPlatform();
  const [version, setVersion] = useState("…");
  const [settings, setSettings] = useState<UpdateSettings>(() => loadUpdateSettings());
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(false);
  /** 启动时自动检查发现的新版本（没有就是 null） */
  const notice = useUpdateNotice();

  useEffect(() => {
    let alive = true;
    void appVersion().then((v) => {
      if (alive) setVersion(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const patch = (p: Partial<UpdateSettings>) => {
    setSettings(saveUpdateSettings(p));
  };

  const check = async () => {
    if (checking) return;
    setChecking(true);
    setResult(null);
    const r = await checkForUpdates(version);
    setResult(r);
    // 手动检查顺手同步启动时那个提示：查到新的就记上，确认是最新的就摘掉，
    // 免得「我的」的角标和这一页的结论互相打架
    if (r.status === "available") setUpdateNotice(r.info);
    else if (r.status === "latest") clearUpdateNotice();
    setSettings(loadUpdateSettings());
    setChecking(false);
  };

  const source = getSelectedSource();
  const statusText = checking
    ? "正在检查…"
    : !result
      ? "尚未检查"
      : result.status === "latest"
        ? "已是最新版本"
        : result.status === "available"
          ? `有新版本 ${result.info.version}`
          : result.status === "unsupported"
            ? result.reason
            : `检查失败：${result.reason}`;

  return (
    <div className={s.page}>
      <div className={s.phead}>
        <button type="button" className={s.back} onClick={onBack}>
          ← 我的
        </button>
        <div className={s.pheadRow}>
          <h1>关于</h1>
          <span className={s.pn}>v{version}</span>
        </div>
      </div>

      <section className={s.block}>
        <p className={s.about}>
          <b>
            {APP_NAME} v{version}
          </b>
          <br />
          本地优先的日记与笔记应用。数据只保存在这台设备上，不经过服务器。
        </p>
        <p className={s.permMeta}>
          {platformLabel(platform)} · 更新可在应用内检查{canSelfInstall() ? "并安装" : "，但浏览器里只能给你下载链接"}
        </p>
      </section>

      <section className={s.block}>
        <h2 className={s.bh}>更新</h2>

        {/* 启动时自动检查的结论：只是记在这儿，等用户自己进来看 */}
        {notice && (
          <div className={s.autoNotice} data-auto-update={notice.version}>
            <p className={s.autoNoticeText}>
              发现新版本 <b className={s.autoNoticeVer}>{notice.version}</b>
            </p>
            {notice.date && <span className={s.autoNoticeMeta}>{notice.date}</span>}
            {notice.url ? (
              <a className={s.autoNoticeLink} href={notice.url} target="_blank" rel="noreferrer">
                下载
              </a>
            ) : (
              <span className={s.autoNoticeMeta}>这个更新源没给下载地址。</span>
            )}
          </div>
        )}

        <div className={s.row}>
          <span className={s.rowLabel}>当前版本</span>
          <span className={s.updateValue}>v{version}</span>
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>更新源</span>
          <select
            className={s.updateSelect}
            value={settings.source}
            onChange={(e) => patch({ source: e.target.value })}
          >
            {listUpdateSources().map((src) => (
              <option key={src.id} value={src.id}>
                {src.label}
              </option>
            ))}
          </select>
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>通道</span>
          <select
            className={s.updateSelect}
            value={settings.channel}
            onChange={(e) => patch({ channel: e.target.value === "beta" ? "beta" : "stable" })}
          >
            <option value="stable">稳定版</option>
            <option value="beta">测试版</option>
          </select>
        </div>

        <div className={s.row}>
          <span className={s.rowLabel}>打开应用时自动检查</span>
          <Seg
            label="打开应用时自动检查"
            options={[
              { key: "on", label: "开" },
              { key: "off", label: "关" },
            ]}
            value={settings.autoCheck ? "on" : "off"}
            onChange={(v) => patch({ autoCheck: v === "on" })}
          />
        </div>

        {settings.source === "github" ? (
          <>
            <div className={s.row}>
              <span className={s.rowLabel}>GitHub 仓库</span>
              <input
                className={s.updateInput}
                value={settings.githubRepo}
                placeholder="owner/repo，例如 sparrow-note/sparrow"
                spellCheck={false}
                autoCapitalize="off"
                onChange={(e) => patch({ githubRepo: e.target.value })}
              />
            </div>
            <p className={s.permMeta}>
              只填 <code>owner/repo</code>（也可以直接粘仓库地址）。走 GitHub 公开 API，不需要令牌；
              未登录额度是每小时 60 次，超了会提示限流。测试通道读的是 prerelease。
            </p>
          </>
        ) : (
          <>
            <div className={s.row}>
              <span className={s.rowLabel}>更新地址</span>
              <input
                className={s.updateInput}
                value={settings.endpoint}
                placeholder="https://example.com/sparrow/latest.json"
                onChange={(e) => patch({ endpoint: e.target.value })}
                readOnly={!editing}
              />
            </div>
            <p className={s.permMeta}>
              预留接口：填一个返回 <code>{`{ "version": "0.2.0", "notes": "…", "url": "…" }`}</code> 的地址即可。
              该地址需要允许跨域（CORS）；想换成 GitHub Release，把上面的更新源切过去、填仓库名就行。
            </p>
          </>
        )}

        <div className={s.permActions}>
          <button type="button" className={s.permBtn} onClick={() => void check()} disabled={checking}>
            {checking ? "检查中…" : "检查更新"}
          </button>
          {settings.source !== "github" && (
            <button type="button" className={s.permBtnGhost} onClick={() => setEditing((v) => !v)}>
              {editing ? "完成编辑" : "编辑地址"}
            </button>
          )}
        </div>

        <p className={s.updateStatus} data-status={result?.status ?? "idle"}>
          {statusText}
        </p>
        {result?.status === "available" && (
          <>
            <p className={s.permMeta}>
              新版本 {result.info.version}
              {result.info.date ? ` · ${result.info.date}` : ""}
              {result.info.mandatory ? " · 建议尽快更新" : ""}
            </p>
            {result.info.notes && <p className={s.permNote}>{result.info.notes}</p>}
            {result.info.url ? (
              <a className={s.updateLink} href={result.info.url} target="_blank" rel="noreferrer">
                去下载
              </a>
            ) : (
              <p className={s.permMeta}>这个更新源没给下载地址。</p>
            )}
          </>
        )}

        <p className={s.permMeta}>
          上次检查：{fmtTime(settings.lastCheckAt)} · 当前源：{source.label}
        </p>
      </section>

      <section className={s.block}>
        <h2 className={s.bh}>关于这个应用</h2>
        <div className={s.row}>
          <span className={s.rowLabel}>数据位置</span>
          <span className={s.permMeta}>
            开发版在程序旁边；打包安装后放在系统的用户数据目录，可在「设置 → 存储」里看到完整路径。
          </span>
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>隐私</span>
          <span className={s.permMeta}>没有账号、没有上传；联网只用于地名检索与地图瓦片。</span>
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>许可</span>
          <span className={s.permMeta}>个人使用；捆绑的开源组件见下。</span>
        </div>
        <p className={s.permNote}>
          BlockNote（MPL-2.0）· ProseMirror（MIT）· React（MIT）· Tauri（Apache-2.0 / MIT）· pdfjs-dist（Apache-2.0）·
          Shiki（MIT）
        </p>
      </section>
    </div>
  );
}
