import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { AccountBlockT } from "./config";

export default function AccountDisplay({ block }: { block: AccountBlockT }) {
  const { site, user, pass } = block.props;
  if (!site && !user && !pass) {
    return <span className={shared.empty}>点击填写账号</span>;
  }
  return (
    <>
      <div className={s.top}>
        <span className={s.site}>
          {site || "未命名账号"}
          {user && <span className={s.user}> · {user}</span>}
        </span>
      </div>
      {pass && <div className={s.pass}>密码：••••••••••</div>}
    </>
  );
}
