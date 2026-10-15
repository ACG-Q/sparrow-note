import type { DayCount } from "../lib/stats";
import s from "./Heatmap.module.css";

function level(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

export function Heatmap({
  cells,
  onPickDate,
}: {
  cells: DayCount[];
  onPickDate: (date: string) => void;
}) {
  return (
    <div className={s.grid}>
      {cells.map((c) => (
        <button
          key={c.date}
          className={`${s.cell} ${s[`lv${level(c.count)}`]}`}
          title={`${c.date} · ${c.count} 篇`}
          aria-label={`${c.date} ${c.count} 篇`}
          onClick={() => onPickDate(c.date)}
        />
      ))}
    </div>
  );
}
