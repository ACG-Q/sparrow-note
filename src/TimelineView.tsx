import { useMemo } from "react";
import type { NoteDoc } from "./db/notes";
import { dateKey } from "./lib/stats";
import { useSettings } from "./lib/settings";
import {
  bodyChars,
  bodyText,
  dayParts,
  formatChars,
  groupByDay,
  monthLabel,
  monthPrefixOf,
  monthSummary,
  moodParts,
  timeOf,
} from "./lib/timeline";
import s from "./TimelineView.module.css";

/** 日期筛选值换成「10 月 13 日」这种好读的写法 */
function dateOrText(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return `${Number(value.slice(5, 7))} 月 ${Number(value.slice(8, 10))} 日`;
}

function todayLabel(): string {
  const now = new Date();
  const week = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
  return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${week}`;
}

export function TimelineView({
  notes,
  onOpenNote,
  onCreate,
  onOpenMenu,
  dark,
  onToggleTheme,
  query,
  onClearQuery,
  dateFilter,
  onClearDate,
}: {
  notes: NoteDoc[];
  onOpenNote: (id: string) => void;
  onCreate: () => void;
  onOpenMenu: () => void;
  dark: boolean;
  onToggleTheme: () => void;
  /** 关键词搜索（来自搜索面板），只在空态里参与判断，不显示成筛选条 */
  query?: string;
  onClearQuery: () => void;
  /** 日期筛选：点热力格/日历选中的那天，空串=不筛选 */
  dateFilter?: string;
  onClearDate: () => void;
}) {
  const settings = useSettings();
  const groups = useMemo(() => groupByDay(notes), [notes]);
  const texts = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notes) map.set(n.id, bodyText(n));
    return map;
  }, [notes]);

  // 筛选条只反映日期筛选；搜索词由搜索面板自己管
  const filterBar = dateFilter ? (
    <div className={s.filterBar}>
      <span className={s.filterLabel}>
        筛选
        <b>{dateOrText(dateFilter)}</b>
      </span>
      <span className={s.grow} />
      <button type="button" className={s.filterClear} onClick={onClearDate}>
        显示全部
      </button>
    </div>
  ) : null;

  const today = dateKey(new Date());
  const prefix = monthPrefixOf(notes);
  const label = monthLabel(prefix);
  const summary = monthSummary(notes, prefix);
  const monthGroups = groups.filter((g) => g.date.startsWith(prefix));

  const mast = (
    <header className={s.mast}>
      <div className={s.mastRow}>
        <span className={s.seal} aria-hidden="true">雀</span>
        <div className={s.mastId}>
          <h1>麻雀记</h1>
          <p className={s.sub}>Sparrow Note · {notes.length} 篇</p>
        </div>
        <button
          className={s.mastTool}
          onClick={onToggleTheme}
          aria-label={dark ? "切换到日间纸" : "切换到夜间纸"}
        >
          {dark ? "日间" : "夜间"}
        </button>
        <button className={s.mastTool} onClick={onOpenMenu} aria-label="打开菜单">
          目录
        </button>
      </div>
      <div className={s.mastDate}>
        <span>{todayLabel()}</span>
        <span className={s.grow} />
        <span>共 {notes.length} 篇</span>
      </div>
    </header>
  );

  if (notes.length === 0) {
    const filtering = Boolean(dateFilter || query);
    // 空态里的「显示全部」要把人带回全部：日期和关键词一起清，否则清完仍是空的
    const clearAll = () => {
      onClearDate();
      onClearQuery();
    };
    return (
      <div className={s.page}>
        {mast}
        <div className={s.empty}>
          {filtering ? (
            <>
              {filterBar}
              <p className={s.emptyTitle}>{dateFilter ? "这天没有记录" : "没有匹配的记录"}</p>
              <p className={s.emptySub}>筛选条件下没有内容，清掉筛选就能看全部。</p>
              <button className={s.emptyBtn} onClick={clearAll}>
                显示全部
              </button>
            </>
          ) : (
            <>
              <p className={s.emptyTitle}>还没有记录</p>
              <p className={s.emptySub}>写下的第一句，会成为这一期的第一篇。</p>
              <button className={s.emptyBtn} onClick={onCreate}>
                写第一条
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={s.page}>
      {mast}

      {filterBar}

      <div className={s.mhead}>
        <div className={s.month}>
          <span className={s.monthNum}>{label.month}</span>
          <span className={s.monthCn}>{label.cn}</span>
          <span className={s.monthEn}>{label.en}</span>
        </div>
        <p className={s.counts}>
          {summary.count} 篇 · {summary.days} 天 · {formatChars(summary.chars)} 字
        </p>
      </div>

      {monthGroups.map(({ date, notes: items }) => {
        const { day, week } = dayParts(date);
        return (
          <section key={date} className={s.day}>
            <div className={date === today ? `${s.dayMark} ${s.today}` : s.dayMark}>
              <span className={s.d}>{day}</span>
              <span className={s.w}>{week}</span>
            </div>
            <div className={s.dayItems}>
              {items.map((note) => {
                const text = texts.get(note.id) ?? "";
                const mood = moodParts(note);
                return (
                  <button
                    key={note.id}
                    type="button"
                    className={s.entry}
                    onClick={() => onOpenNote(note.id)}
                  >
                    <span className={s.t}>{note.title || "无标题"}</span>
                    {text && <span className={s.x}>{text}</span>}
                    <span className={s.m}>
                      <span>{timeOf(note)}</span>
                      {settings.showMoodMeta && mood.char && (
                        <>
                          <i>·</i>
                          <span>
                            <span className={s.moodMark}>{mood.char}</span>
                            {mood.text ? ` ${mood.text}` : ""}
                          </span>
                        </>
                      )}
                      <i>·</i>
                      <span>{bodyChars(note)} 字</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className={s.listEnd}>
        <span className={s.sq} />
        {label.cn} · 共 {summary.count} 篇
        <span className={s.sq} />
      </p>
    </div>
  );
}
