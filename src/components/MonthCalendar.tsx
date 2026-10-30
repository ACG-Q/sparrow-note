import { dateKey } from "../lib/stats";
import s from "./MonthCalendar.module.css";

const WEEK_CN = ["一", "二", "三", "四", "五", "六", "日"];

export function MonthCalendar({
  year,
  month,
  counts,
  selected,
  today,
  onSelect,
}: {
  year: number;
  month: number;
  counts: Map<string, number>;
  selected: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const total = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className={s.grid} role="group" aria-label={`${year} 年 ${month} 月记录日历`}>
      {WEEK_CN.map((w) => (
        <span key={w} className={s.wd} aria-hidden="true">
          {w}
        </span>
      ))}
      {cells.map((d, i) => {
        if (d === null) return <span key={`b${i}`} className={s.blank} aria-hidden="true" />;
        const key = dateKey(new Date(year, month - 1, d));
        const has = (counts.get(key) ?? 0) > 0;
        const cls = [
          s.cell,
          has ? s.has : "",
          key === today ? s.today : "",
          key === selected ? s.selected : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={key}
            type="button"
            className={cls}
            aria-pressed={key === selected}
            aria-label={`${month} 月 ${d} 日${has ? "，有记录" : ""}`}
            onClick={() => onSelect(key)}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}
