import { daysUntil } from "../../../lib/aggregate";
import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { AnniversaryBlockT } from "./config";

export default function AnniversaryDisplay({
  block,
  onEdit,
}: {
  block: AnniversaryBlockT;
  onEdit: () => void;
}) {
  const days = daysUntil(block.props.date);
  return (
    <div className={`${shared.display} ${s.root}`} onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}>
      <span className={s.title}>{block.props.title || "未命名纪念日"}</span>
      {block.props.date && <span className={s.date}>{block.props.date}</span>}
      {days !== null && (
        <span className={days > 0 && days <= 7 ? `${s.countdown} ${s.urgent}` : s.countdown}>
          {days > 0 ? `还有 ${days} 天` : days === 0 ? "就是今天" : `第 ${-days + 1} 天`}
        </span>
      )}
      <span className={shared.editHint} contentEditable={false}>
        点击编辑
      </span>
    </div>
  );
}
