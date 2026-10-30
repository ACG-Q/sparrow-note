import type { CSSProperties } from "react";
import type { NavView } from "../lib/nav";
import s from "./BottomTabs.module.css";

const ITEMS: { key: NavView; label: string; idx: string }[] = [
  { key: "timeline", label: "时间线", idx: "01" },
  { key: "summary", label: "汇总", idx: "02" },
  { key: "profile", label: "我的", idx: "03" },
];

export function BottomTabs({
  view,
  onNavigate,
}: {
  view: NavView;
  onNavigate: (v: NavView) => void;
}) {
  const index = Math.max(0, ITEMS.findIndex((i) => i.key === view));
  return (
    <nav className={s.tabs} style={{ "--i": index } as CSSProperties} aria-label="主导航">
      <span className={s.mark} aria-hidden="true" />
      {ITEMS.map(({ key, label, idx }) => (
        <button
          key={key}
          type="button"
          className={(view === key || (view === "checklist" && key === "summary")) ? `${s.tab} ${s.tabActive}` : s.tab}
          aria-current={(view === key || (view === "checklist" && key === "summary")) ? "page" : undefined}
          onClick={() => onNavigate(key)}
        >
          <span className={s.idx}>{idx}</span>
          <span className={s.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
