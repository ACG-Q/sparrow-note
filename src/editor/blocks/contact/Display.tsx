import shared from "../_shared/blockCommon.module.css";
import type { ContactBlockT } from "./config";

export default function ContactDisplay({ block }: { block: ContactBlockT }) {
  const { name, phone, company, title } = block.props;
  if (!name && !phone && !company && !title) {
    return <span className={shared.empty}>点击填写姓名</span>;
  }
  const sub = [phone, company, title].filter(Boolean).join(" · ");
  return (
    <div className={shared.bcBody}>
      <span className={shared.bcTitle}>{name || "未命名联系人"}</span>
      {sub && <span className={shared.bcMeta}>{sub}</span>}
    </div>
  );
}
