import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { ContactBlockT } from "./config";

export default function ContactDisplay({
  block,
  onEdit,
}: {
  block: ContactBlockT;
  onEdit: () => void;
}) {
  const { name, phone, relation } = block.props;
  return (
    <div className={`${shared.display} ${s.root}`} onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}>
      <div className={s.row}>
        {name && <span className={s.name}>{name}</span>}
        {phone && <span className={s.phone}>{phone}</span>}
        {relation && <span className={s.relation}>{relation}</span>}
        {!name && !phone && !relation && <span className={shared.muted}>空联系人</span>}
      </div>
      <span className={shared.editHint} contentEditable={false}>
        点击编辑
      </span>
    </div>
  );
}
