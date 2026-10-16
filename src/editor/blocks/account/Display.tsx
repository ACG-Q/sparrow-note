import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { AccountBlockT } from "./config";

export default function AccountDisplay({ block }: { block: AccountBlockT }) {
  const { site, user, pass, note } = block.props;
  if (!site && !user && !pass && !note) {
    return <span className={shared.empty}>点击填写账号</span>;
  }
  return (
    <>
      <div className={s.top}>
        <span className={s.site}>{site || "未命名账号"}</span>
        {note && <span className={s.note}>{note}</span>}
      </div>
      <div className={s.creds}>
        {user && <span className={s.user}>{user}</span>}
        {pass && <span className={s.pass}>密码：••••••••</span>}
      </div>
    </>
  );
}
