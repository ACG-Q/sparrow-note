import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { dayStats, type AnniversaryBlockT, type DayKind } from "./config";

export default function AnniversaryDisplay({ block }: { block: AnniversaryBlockT }) {
  const { title, date, kind, annual } = block.props;
  if (!title && !date) {
    return <span className={shared.empty}>点击填写名称</span>;
  }
  const stats = dayStats(kind as DayKind, date, annual);
  return (
    <div className={shared.bcBody}>
      <span className={shared.bcTitle}>{title || "点击填写名称"}</span>
      <span className={s.meta}>
        {stats && <span className={s.num}>{stats.num}</span>}
        {stats?.tag && <span className={shared.bcMeta}>{stats.tag}</span>}
        {date && <span className={shared.bcMeta}>{stats?.sub ?? date}</span>}
      </span>
    </div>
  );
}
