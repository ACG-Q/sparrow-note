import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { ContactBlockT } from "./config";

export default function ContactDisplay({ block }: { block: ContactBlockT }) {
  const { name, phone, relation } = block.props;
  if (!name && !phone && !relation) {
    return <span className={shared.empty}>点击填写联系人</span>;
  }
  return (
    <div className={s.row}>
      {name && <span className={s.name}>{name}</span>}
      {phone && <span className={s.phone}>{phone}</span>}
      {relation && <span className={s.relation}>{relation}</span>}
    </div>
  );
}
