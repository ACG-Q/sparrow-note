import { useMemo, useState } from "react";
import type { NoteDoc } from "./db/notes";
import { bodyTextOfBlocks, collectSummary, type SummaryEntry } from "./lib/aggregate";
import { dateKey, heatmap, last7Days, moodCountsThisMonth, streaks } from "./lib/stats";
import { checklistCounts, collectChecklist } from "./lib/checklist";
import { dateShort } from "./lib/timeline";
import { moodChar } from "./lib/mood";
import { SUMMARY_KIND_META, useSettings, type SummaryKind } from "./lib/settings";
import { MonthCalendar } from "./components/MonthCalendar";
import { Heatmap } from "./components/Heatmap";
import s from "./SummaryView.module.css";

const MONTH_CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
const WEEKDAY_CN = ["日", "一", "二", "三", "四", "五", "六"];

/** 从 2026-10-28 这种日期里取星期几（回顾区柱下的单字） */
function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAY_CN[new Date(y, m - 1, d).getDay()];
}

function metaDate(date: string): string {
  return dateShort(date);
}

function rightText(e: SummaryEntry): string {
  if (e.days !== undefined && e.days !== null) {
    if (e.days === 0) return "今天";
    return `${Math.abs(e.days)} 天${e.days > 0 ? "后" : "前"}`;
  }
  return e.right ?? "";
}

export function SummaryView({
  notes,
  onOpenNote,
  onOpenMenu,
  onOpenPersonalize,
  onOpenChecklist,
}: {
  notes: NoteDoc[];
  onOpenNote: (id: string) => void;
  onOpenMenu: () => void;
  onOpenPersonalize: () => void;
  onOpenChecklist: () => void;
}) {
  const settings = useSettings();
  const kinds = settings.summaryKinds;
  const [picked, setPicked] = useState<SummaryKind | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const tab: SummaryKind | null =
    picked && kinds.includes(picked) ? picked : (kinds[0] ?? null);

  const today = dateKey(new Date());
  const currentPrefix = today.slice(0, 7);
  const derivedPrefix = useMemo(() => {
    if (notes.some((n) => n.date.startsWith(currentPrefix))) return currentPrefix;
    const latest = [...notes].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return latest ? latest.date.slice(0, 7) : currentPrefix;
  }, [notes, currentPrefix]);
  // 点热力图里别的月份时，临时切到那个月
  const [prefixOverride, setPrefixOverride] = useState<string | null>(null);
  const prefix = prefixOverride ?? derivedPrefix;

  const streak = useMemo(() => streaks(notes), [notes]);
  const heat = useMemo(() => heatmap(notes, 16), [notes]);
  const week = useMemo(() => last7Days(notes), [notes]);
  const weekMax = Math.max(1, ...week.map((d) => d.count));
  /** 点热力格 / 点 7 天柱都落到同一天：切到那个月，再筛那一天 */
  const pickDay = (d: string) => {
    setPrefixOverride(d.slice(0, 7));
    setFilterDate(d);
  };
  // 心情分布跟着当前显示的月份，切月后不会串
  const year = Number(prefix.slice(0, 4));
  const month = Number(prefix.slice(5, 7));
  const monthCn = `${MONTH_CN[month - 1]}月`;

  // 心情分布跟着当前显示的月份，切月后不会串
  // 清单待办数：汇总页的固定入口用，不依赖右栏有没有启用「清单」分类
  const checklistOpen = useMemo(() => checklistCounts(collectChecklist(notes)).open, [notes]);

  const moods = useMemo(
    () => moodCountsThisMonth(notes, new Date(year, month - 1, 15)),
    [notes, year, month],
  );

  const monthNotes = useMemo(() => notes.filter((n) => n.date.startsWith(prefix)), [notes, prefix]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of monthNotes) map.set(n.date, (map.get(n.date) ?? 0) + 1);
    return map;
  }, [monthNotes]);
  const chars = useMemo(
    () =>
      monthNotes.reduce(
        (n, note) => n + bodyTextOfBlocks(note.blocks).replace(/\s+/g, "").length,
        0,
      ),
    [monthNotes],
  );

  /** 每类在本月、本日过滤后的条目 */
  const entries = useMemo(() => {
    const map = new Map<SummaryKind, SummaryEntry[]>();
    for (const k of kinds) {
      map.set(
        k,
        collectSummary(notes, k).filter(
          (e) => e.noteDate.startsWith(prefix) && (!filterDate || e.noteDate === filterDate),
        ),
      );
    }
    return map;
  }, [notes, kinds, prefix, filterDate]);

  const day = filterDate ? Number(filterDate.slice(8)) : 0;
  const list = tab ? (entries.get(tab) ?? []) : [];

  return (
    <div className={s.page}>
      <header className={s.phead}>
        <h1>汇总</h1>
        <span className={s.pn}>
          {monthCn} · {year}
        </span>
        <button className={s.menuBtn} onClick={onOpenMenu} aria-label="打开菜单">
          目录
        </button>
      </header>

      <div className={s.cols}>
        <div className={s.left}>
          <div className={s.stats}>
            <div className={s.stat}>
              <b>{monthNotes.length}</b>
              <span>篇</span>
            </div>
            <div className={s.stat}>
              <b>{counts.size}</b>
              <span>天有记</span>
            </div>
            <div className={s.stat}>
              <b>{chars.toLocaleString("zh-CN")}</b>
              <span>字</span>
            </div>
          </div>

          <div className={s.calWrap}>
        <div className={s.calHead}>
          <span className={s.calTitle}>
            {monthCn} · 记了 {counts.size} 天
          </span>
          {filterDate ? (
            <button className={s.clear} onClick={() => setFilterDate("")}>
              清除 · {day} 日
            </button>
          ) : prefix !== derivedPrefix ? (
            <button className={s.clear} onClick={() => setPrefixOverride(null)}>
              回到本月
            </button>
          ) : (
            <span className={s.calNote}>红点 = 有记录</span>
          )}
        </div>
        <MonthCalendar
          year={year}
          month={month}
          counts={counts}
          selected={filterDate}
          today={today}
          onSelect={(d) => setFilterDate(d === filterDate ? "" : d)}
        />
          </div>
                    <div className={s.rvC}>
            <div className={s.rvHead}>
              <span className={s.rvT}>回顾</span>
              <span className={s.rvH}>
                {year} · {monthCn}
              </span>
            </div>

            {/* C 型账本：左列等宽小标签当日志行名，右侧按行放内容，行间一条细线 */}
            <div className={s.led}>
              <div className={s.lab}>连续打卡</div>
              <div className={`${s.val} ${s.valTxt}`}>
                连续<b>{streak.current}</b>天<s>·</s>最长<b>{streak.longest}</b>天
              </div>

              <div className={s.lab}>近 7 天</div>
              <div className={s.val}>
                <div className={s.barrow}>
                  {week.map((d) => (
                    <button
                      key={d.date}
                      type="button"
                      className={[
                        s.bc,
                        d.count === 0 ? s.bcZero : "",
                        d.date === today ? s.bcToday : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      title={`${d.date} · ${d.count} 篇`}
                      aria-label={`${d.date} ${d.count} 篇`}
                      onClick={() => pickDay(d.date)}
                    >
                      <span className={s.bn}>{d.count}</span>
                      <span className={s.bt}>
                        <i style={{ height: `${Math.round((d.count / weekMax) * 100)}%` }} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className={s.days}>
                  {week.map((d) => (
                    <span key={d.date} className={d.date === today ? s.dayToday : s.day}>
                      {weekdayOf(d.date)}
                    </span>
                  ))}
                </div>
              </div>

              <div className={s.lab}>近 16 周</div>
              <div className={s.val}>
                <Heatmap cells={heat} fluid onPickDate={pickDay} />
                <div className={s.cap3}>点格子按那天筛</div>
              </div>

              <div className={s.lab}>
                心情
                <br />
                {monthCn}
              </div>
              <div className={s.val}>
                {moods.length === 0 ? (
                  <p className={s.moodEmpty}>{monthCn}还没有心情记录</p>
                ) : (
                  <div className={s.moods3}>
                    {moods.map((m, i) => (
                      <div className={s.m3} key={m.emoji}>
                        <span className={s.ch}>{moodChar(m.emoji)}</span>
                        <span className={s.n}>{m.count}</span>
                        <span className={s.tr}>
                          <i
                            style={{
                              width: `${Math.round((m.count / (moods[0]?.count || 1)) * 100)}%`,
                              background: `color-mix(in srgb, var(--seal) ${[100, 62, 34, 14][i] ?? 14}%, var(--paper-3))`,
                            }}
                          />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button type="button" className={s.checklistEntry} onClick={onOpenChecklist}>
              <span className={s.ceLabel}>清单</span>
              <b className={s.ceCount}>{checklistOpen}</b>
              <span className={s.ceUnit}>件待办</span>
              <span className={s.ceGo}>全部清单 →</span>
            </button>
          </div>
        </div>

        <div className={s.right}>
          {kinds.length === 0 ? (
            <div className={s.emptyBox}>
              <p className={s.empty}>汇总里还没有任何分类。</p>
              <button type="button" className={s.emptyAction} onClick={onOpenPersonalize}>
                去「个性化」选几类 →
              </button>
            </div>
          ) : (
            <>
              <div className={s.segWrap}>
            <div className={s.seg} role="tablist" aria-label="汇总分类">
              {kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  className={tab === k ? `${s.segBtn} ${s.segOn}` : s.segBtn}
                  onClick={() => setPicked(k)}
                >
                  {SUMMARY_KIND_META[k].label}
                  <span className={s.segN}>{entries.get(k)?.length ?? 0}</span>
                </button>
              ))}
            </div>
            <div className={s.segMenuWrap}>
              <button
                type="button"
                className={menuOpen ? `${s.segMenuBtn} ${s.segMenuOn}` : s.segMenuBtn}
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
                aria-label="选择分类"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                  <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className={s.menuMask} onClick={() => setMenuOpen(false)} />
                  <div className={s.menu} role="listbox" aria-label="分类">
                    {kinds.map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="option"
                        aria-selected={tab === k}
                        className={tab === k ? `${s.menuItem} ${s.menuItemOn}` : s.menuItem}
                        onClick={() => {
                          setPicked(k);
                          setMenuOpen(false);
                        }}
                      >
                        <span>{SUMMARY_KIND_META[k].label}</span>
                        <span className={s.menuN}>{entries.get(k)?.length ?? 0}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className={s.menuFoot}
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenPersonalize();
                      }}
                    >
                      调整分类 →
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={s.list}>
            {list.length === 0 && (
              <p className={s.empty}>
                {filterDate ? "这一天没有这一类记录。" : "这一时期还没有这类记录。"}
              </p>
            )}
            {list.map((e, i) => {
              const right = rightText(e);
              const soon = e.days !== undefined && e.days !== null && e.days >= 0 && e.days <= 7;
              return (
                <button
                  key={`${e.noteId}-${i}`}
                  className={e.done ? `${s.row} ${s.rowDone}` : s.row}
                  onClick={() => onOpenNote(e.noteId)}
                >
                  {e.mark !== undefined && (
                    <span className={s.mark} aria-hidden="true">
                      {moodChar(e.mark)}
                    </span>
                  )}
                  <span className={s.body}>
                    <span className={s.primary}>{e.primary}</span>
                    <span className={s.meta}>
                      {metaDate(e.noteDate)} · {e.noteTitle || "无标题"}
                      {e.secondary ? ` · ${e.secondary}` : ""}
                    </span>
                  </span>
                  {right && (
                    <span className={soon ? `${s.right} ${s.soon}` : s.right}>{right}</span>
                  )}
                </button>
              );
            })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
