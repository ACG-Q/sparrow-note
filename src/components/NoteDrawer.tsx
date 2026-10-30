import { useLayoutEffect, useMemo, useRef } from "react";
import type { NoteDoc } from "../db/notes";
import { heatmap, last7Days, moodCountsThisMonth, streaks, summarize } from "../lib/stats";
import { moodChar } from "../lib/mood";
import { themeLabel, resolveDark, type ThemePref } from "../lib/theme";
import { Heatmap } from "./Heatmap";
import s from "./NoteDrawer.module.css";

export function NoteDrawer({
  open,
  notes,
  themePref,
  onCycleTheme,
  onClose,
  onCreate,
  onOpenSettings,
  onPickDate,
  onClearFilter,
}: {
  open: boolean;
  notes: NoteDoc[];
  themePref: ThemePref;
  onCycleTheme: () => void;
  onClose: () => void;
  onCreate: () => void;
  onOpenSettings: () => void;
  onPickDate: (date: string) => void;
  onClearFilter?: () => void;
}) {
  const summary = useMemo(() => summarize(notes), [notes]);
  const streak = useMemo(() => streaks(notes), [notes]);
  const cells = useMemo(() => heatmap(notes, 16), [notes]);
  const week = useMemo(() => last7Days(notes), [notes]);
  const moods = useMemo(() => moodCountsThisMonth(notes), [notes]);
  const maxCount = Math.max(1, ...week.map((d) => d.count));
  const today = week[week.length - 1];
  const asideRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (open) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement && asideRef.current?.contains(el)) el.blur();
  }, [open]);

  return (
    <>
      <div
        className={open ? `${s.backdrop} ${s.backdropOpen}` : s.backdrop}
        onClick={onClose}
      />
      <aside
        ref={asideRef}
        className={open ? `${s.drawer} ${s.drawerOpen}` : s.drawer}
        aria-hidden={!open}
      >
        <div className={s.head}>
          <div className={s.brand}>
            <span className={s.seal} aria-hidden="true">雀</span>
            <span className={s.logo}>麻雀记</span>
          </div>
          <div className={s.actions}>
            <button
              className={s.iconBtn}
              onClick={onCycleTheme}
              aria-label="切换主题"
              title={`切换主题（当前：${themeLabel(themePref)}）`}
            >
              {resolveDark(themePref) ? "日间" : "夜间"}
            </button>
            <button className={s.iconBtn} onClick={onOpenSettings} aria-label="打开设置">
              设置
            </button>
            <button className={s.iconBtn} onClick={onClose} aria-label="关闭">
              ×
            </button>
          </div>
        </div>
        <div className={s.body}>
          <button className={s.newBtn} onClick={onCreate}>
            ＋ 新笔记
          </button>

          <div className={s.grid3}>
            <div className={s.statCell}>
              <div className={s.statNum}>{summary.today}</div>
              <div className={s.statLabel}>今日新增</div>
            </div>
            <div className={s.statCell}>
              <div className={s.statNum}>{summary.week}</div>
              <div className={s.statLabel}>本周新增</div>
            </div>
            <div className={s.statCell}>
              <div className={s.statNum}>{summary.total}</div>
              <div className={s.statLabel}>总篇数</div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>连续打卡</div>
            <div className={s.streakRow}>
              <div className={s.streakBig}>{streak.current}</div>
              <div>
                <div className={s.streakText}>当前连续天数</div>
                <div className={s.streakSub}>最长纪录 {streak.longest} 天</div>
              </div>
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>贡献热力图</div>
            <Heatmap cells={cells} onPickDate={onPickDate} />
            <div className={s.heatLegend}>
              近 16 周 · 点击格子查看当天列表
              {onClearFilter && (
                <button
                  type="button"
                  className={s.clearFilter}
                  onClick={() => {
                    onClearFilter();
                    onClose();
                  }}
                >
                  显示全部
                </button>
              )}
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>近 7 天</div>
            <div className={s.bars}>
              {week.map((d) => (
                <div key={d.date} className={s.barCol}>
                  <div className={s.barTrack}>
                    <div
                      className={d.date === today.date ? `${s.bar} ${s.barToday}` : s.bar}
                      style={{ height: `${Math.round((d.count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <div className={s.barLabel}>{Number(d.date.slice(8))}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={s.card}>
            <div className={s.cardTitle}>心情分布 · 本月</div>
            {moods.length === 0 ? (
              <div className={s.emptySmall}>本月还没有心情记录</div>
            ) : (
              moods.map((m) => (
                <div key={m.emoji} className={s.moodRow}>
                  <span className={s.moodStamp} aria-hidden="true">
                    {moodChar(m.emoji)}
                  </span>
                  <div className={s.moodTrack}>
                    <div
                      className={s.moodBar}
                      style={{ width: `${Math.round((m.count / moods[0].count) * 100)}%` }}
                    />
                  </div>
                  <span className={s.moodCount}>{m.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
