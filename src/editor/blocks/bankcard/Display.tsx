import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { maskNo, type BankcardBlockT } from "./config";

export default function BankcardDisplay({
  block,
  onEdit,
}: {
  block: BankcardBlockT;
  onEdit: () => void;
}) {
  const { bank, no, holder, kind } = block.props;
  return (
    <div className={`${shared.display} ${s.root}`} onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}>
      <div className={s.top}>
        <span className={s.bank}>{bank || "未填银行"}</span>
        <span className={s.kind}>{kind}</span>
      </div>
      <div className={s.no}>{no ? maskNo(no) : "•••• •••• •••• ••••"}</div>
      <div className={s.holder}>{holder || "未填持卡人"}</div>
      <span className={shared.editHint} contentEditable={false}>
        点击编辑
      </span>
    </div>
  );
}
