import { daysUntil } from "../../../lib/aggregate";
import s from "./styles.module.css";
import type { AnniversaryBlockT } from "./config";

export default function AnniversaryDisplay({ block }: { block: AnniversaryBlockT }) {
  const days = daysUntil(block.props.date);
  return (
    <>
      <span className={s.title}>{block.props.title || "点击填写名称"}</span>
      {block.props.date && <span className={s.date}>{block.props.date}</span>}
      {days !== null && (
        <span className={days > 0 && days <= 7 ? `${s.countdown} ${s.urgent}` : s.countdown}>
          {days > 0 ? `还有 ${days} 天` : days === 0 ? "就是今天" : `第 ${-days + 1} 天`}
        </span>
      )}
    </>
  );
}
