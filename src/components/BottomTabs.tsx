import type { ReactElement } from "react";
import type { NavView } from "../lib/nav";
import { SummaryIcon, TimelineIcon, UserIcon } from "../ui/icons";
import s from "./BottomTabs.module.css";

const ITEMS: { key: NavView; label: string; Icon: () => ReactElement }[] = [
  { key: "timeline", label: "时间线", Icon: TimelineIcon },
  { key: "summary", label: "汇总", Icon: SummaryIcon },
  { key: "profile", label: "我的", Icon: UserIcon },
];

export function BottomTabs({
  view,
  onNavigate,
}: {
  view: NavView;
  onNavigate: (v: NavView) => void;
}) {
  return (
    <nav className={s.tabs}>
      {ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={view === key ? `${s.tab} ${s.tabActive}` : s.tab}
          onClick={() => onNavigate(key)}
        >
          <Icon />
          <span className={s.label}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
