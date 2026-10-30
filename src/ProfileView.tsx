import { useMemo, useState } from "react";
import type { NoteDoc } from "./db/notes";
import { collectAnniversaries, collectContacts, collectMoods } from "./lib/aggregate";
import { dateRange } from "./lib/timeline";
import { useUpdateNotice } from "./lib/updateNotice";
import s from "./ProfileView.module.css";

const NAME_KEY = "sparrow-nickname";

function loadName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
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
  /** 启动时自动检查发现的版本：只在这儿点一枚小红点，不自动跳页 */
  const notice = useUpdateNotice();

  const stats = useMemo(() => {
    const moods = collectMoods(notes).length;
    const contacts = collectContacts(notes).length;
    const days = collectAnniversaries(notes).length;
    const dates = notes.map((n) => n.date).sort();
    return {
      noteCount: notes.length,
      moodCount: moods,
      contactCount: contacts,
      dayCount: days,
      firstDate: dates[0] ?? "—",
      lastDate: dates[dates.length - 1] ?? "—",
    };
  }, [notes]);

  const saveName = () => {
    localStorage.setItem(NAME_KEY, name.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className={s.page}>
      <header className={s.phead}>
        <h1>我的</h1>
        <span className={s.pn}>v0.1.0</span>
        <button className={s.menuBtn} onClick={onOpenMenu} aria-label="打开菜单">
          目录
        </button>
      </header>

      <div className={s.who}>
        <div className={name.trim() ? s.avatar : `${s.avatar} ${s.avatarEmpty}`} aria-hidden="true">
          {name.trim() ? name.trim().slice(0, 1) : ""}
        </div>
        <div className={s.nameCol}>
          <input
            className={s.nameInput}
            placeholder="输入昵称"
            value={name}
            maxLength={20}
            aria-label="昵称"
            onChange={(e) => setName(e.target.value)}
          />
          <span className={s.hint}>点一下就能改，20 字以内</span>
        </div>
        <button type="button" className={s.mini} onClick={saveName}>
          {saved ? "已保存" : "保存"}
        </button>
      </div>

      <section className={s.block}>
        <h2 className={s.bh}>统计</h2>
        <dl className={s.table}>
          <div className={s.trow}>
            <dt>笔记</dt>
            <dd>{stats.noteCount} 篇</dd>
          </div>
          <div className={s.trow}>
            <dt>心情</dt>
            <dd>{stats.moodCount} 条</dd>
          </div>
          <div className={s.trow}>
            <dt>联系人</dt>
            <dd>{stats.contactCount} 位</dd>
          </div>
          <div className={s.trow}>
            <dt>纪念日</dt>
            <dd>{stats.dayCount} 个</dd>
          </div>
          <div className={s.trow}>
            <dt>记录范围</dt>
            <dd>
              {dateRange(stats.firstDate, stats.lastDate)}
            </dd>
          </div>
        </dl>
      </section>

      <section className={s.block}>
        <button type="button" className={s.settingRow} onClick={onOpenPersonalize}>
          <span className={s.settingLabel}>个性化</span>
          <span className={s.settingHint}>外观 · 阅读 · 汇总分类</span>
          <span className={s.settingArrow} aria-hidden="true">
            →
          </span>
        </button>
        <button type="button" className={s.settingRow} onClick={onOpenPermissions}>
          <span className={s.settingLabel}>权限</span>
          <span className={s.settingHint}>位置 · 麦克风 · 相机 · 网络</span>
          <span className={s.settingArrow} aria-hidden="true">
            →
          </span>
        </button>
        <button type="button" className={s.settingRow} onClick={onOpenSettings}>
          <span className={s.settingLabel}>设置</span>
          <span className={s.settingHint}>数据 · 地图</span>
          <span className={s.settingArrow} aria-hidden="true">
            →
          </span>
        </button>
        <button type="button" className={s.settingRow} onClick={onOpenAbout}>
          <span className={s.settingLabel}>关于</span>
          <span className={s.settingHint}>版本 · 检查更新</span>
          {notice && (
            <span
              className={s.newDot}
              data-new-version={notice.version}
              role="status"
              aria-label={`有新版本 ${notice.version}`}
              title={`有新版本 ${notice.version}`}
            />
          )}
          <span className={s.settingArrow} aria-hidden="true">
            →
          </span>
        </button>
      </section>
    </div>
  );
}
