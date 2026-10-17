import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { ContactBlockT } from "./config";

export default function ContactDisplay({ block }: { block: ContactBlockT }) {
  const { name, phone, company, title } = block.props;
  if (!name && !phone && !company && !title) {
    return <span className={shared.empty}>点击填写姓名</span>;
  }
  const sub = [phone, company, title].filter(Boolean).join(" · ");
  return (
    <div className={s.main}>
      <span className={s.name}>{name || "未命名联系人"}</span>
      {sub && <span className={s.sub}>{sub}</span>}
    </div>
  );
}
