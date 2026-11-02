import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteDoc } from "./db/notes";
import { VERSION_FALLBACK } from "./lib/appInfo";
import { currentPlatform, platformLabel } from "./lib/platform";
import { permissionRows } from "./lib/permissions";
import { useSettings } from "./lib/settings";
import { themeLabel, useThemePref } from "./lib/theme";
import { collectAnniversaries, collectContacts, collectMoods } from "./lib/aggregate";
import { dateRange } from "./lib/timeline";
import { useUpdateNotice } from "./lib/updateNotice";
import { ProfilePage } from "./app/ProfileShell";
import s from "./ProfileView.module.css";

const NAME_KEY = "sparrow-nickname";
/** 没有昵称时印章里放品牌首字，不留一块空纸 */
const BRAND_CHAR = "雀";

const SIZE_TEXT: Record<string, string> = { s: "小", m: "标准", l: "大" };

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function ProfileView({
  notes,
  onOpenSettings,
  onOpenAbout,
  onOpenPersonalize,
  onOpenPermissions,
  onOpenMenu,
}: {
  notes: NoteDoc[];
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenPersonalize: () => void;
  onOpenPermissions: () => void;
  onOpenMenu: () => void;
}) {
  const [name, setName] = useState(loadName);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);
  /** 启动时自动检查发现的版本：只在「关于」那一行点一枚红点，不自动跳页 */
  const notice = useUpdateNotice();
  const theme = useThemePref();
  const settings = useSettings();
  const platform = currentPlatform();

  // 组件卸载时别让定时器继续改已卸载组件的 state
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const stats = useMemo(() => {
    const dates = notes.map((n) => n.date).sort();
    return {
      noteCount: notes.length,
      moodCount: collectMoods(notes).length,
      contactCount: collectContacts(notes).length,
      dayCount: collectAnniversaries(notes).length,
      firstDate: dates[0] ?? "",
      lastDate: dates[dates.length - 1] ?? "",
    };
  }, [notes]);

  const permCount = useMemo(() => permissionRows(platform).length, [platform]);

  /**
   * 昵称改成「失效即存」：不再常驻一个「保存」按钮。
   * 原来那个按钮 90% 时间是无意义的（没改也能点），还占掉一行。
   */
  const commitName = () => {
    const stored = name.trim().slice(0, 20);
    try {
      localStorage.setItem(NAME_KEY, stored);
    } catch {
      /* 存不进去也让界面保持可用，顶多下次重新输 */
    }
    setName(stored);
    setSaved(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaved(false), 1600);
  };

  const initial = name.trim().slice(0, 1);

  return (
    <ProfilePage
      title="我的"
      marker={
        <button type="button" className={s.menuBtn} onClick={onOpenMenu} aria-label="打开目录">
          目录
        </button>
      }
    >
      {/* ---------- 身份 + 数字 + 目录：手机单列，桌面左右对开 ---------- */}
      <div className={s.spread}>
        <div className={s.left}>
          <div className={s.who}>
            <div className={initial ? s.seal : `${s.seal} ${s.sealEmpty}`} aria-hidden="true">
              {initial || BRAND_CHAR}
            </div>
            <div className={s.nameCol}>
              <input
                className={s.nameInput}
                placeholder="留个名字"
                value={name}
                maxLength={20}
                aria-label="昵称"
                enterKeyHint="done"
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
              <span className={s.hint} role={saved ? "status" : undefined}>
                {saved ? "已保存" : "点一下就能改，20 字以内"}
              </span>
            </div>
          </div>

          {/* ---------- 四个数字：这册账本的规模 ---------- */}
          <dl className={s.figures}>
            {[
              { key: "note", value: stats.noteCount, unit: "篇", label: "笔记" },
              { key: "mood", value: stats.moodCount, unit: "条", label: "心情" },
              { key: "contact", value: stats.contactCount, unit: "位", label: "联系人" },
              { key: "day", value: stats.dayCount, unit: "个", label: "纪念日" },
            ].map((f) => (
              <div key={f.key} className={s.figure}>
                <dt className={s.figureValue}>
                  {f.value}
                  <span className={s.figureUnit}>{f.unit}</span>
                </dt>
                <dd className={s.figureLabel}>{f.label}</dd>
              </div>
            ))}
          </dl>

          <p className={s.span}>
            <span className={s.spanKey}>记录跨度</span>
            <span className={s.spanValue}>
              {stats.noteCount > 0 ? dateRange(stats.firstDate, stats.lastDate) : "还没有记录"}
            </span>
          </p>
        </div>

        {/* ---------- 目录：入口本身就是一行书目录 ---------- */}
        <nav className={s.toc} aria-label="设置与信息">
          <h2 className={s.kicker}>目录</h2>

        <button type="button" className={s.entry} onClick={onOpenPersonalize}>
          <span className={s.entryLabel}>个性化</span>
          <span className={s.leader} aria-hidden="true" />
          <span className={s.entryValue}>
            {themeLabel(theme)} · {SIZE_TEXT[settings.readerSize] ?? "标准"}
          </span>
          <span className={s.entryArrow} aria-hidden="true">
            →
          </span>
        </button>

        <button type="button" className={s.entry} onClick={onOpenPermissions}>
          <span className={s.entryLabel}>权限</span>
          <span className={s.leader} aria-hidden="true" />
          <span className={s.entryValue}>{permCount} 项</span>
          <span className={s.entryArrow} aria-hidden="true">
            →
          </span>
        </button>

        <button type="button" className={s.entry} onClick={onOpenSettings}>
          <span className={s.entryLabel}>设置</span>
          <span className={s.leader} aria-hidden="true" />
          <span className={s.entryValue}>{platformLabel(platform)}</span>
          <span className={s.entryArrow} aria-hidden="true">
            →
          </span>
        </button>

        <button type="button" className={s.entry} onClick={onOpenAbout}>
          <span className={s.entryLabel}>关于</span>
          {notice && (
            <span
              className={s.newDot}
              data-new-version={notice.version}
              role="status"
              aria-label={`有新版本 ${notice.version}`}
              title={`有新版本 ${notice.version}`}
            />
          )}
          <span className={s.leader} aria-hidden="true" />
          <span className={s.entryValue}>{notice ? `新 ${notice.version}` : `v${VERSION_FALLBACK}`}</span>
          <span className={s.entryArrow} aria-hidden="true">
            →
          </span>
        </button>
        </nav>
      </div>
    </ProfilePage>
  );
}
