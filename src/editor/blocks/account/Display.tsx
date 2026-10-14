import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { AccountBlockT } from "./config";

export default function AccountDisplay({
  block,
  onEdit,
}: {
  block: AccountBlockT;
  onEdit: () => void;
}) {
  const { site, user, pass, note } = block.props;
  return (
    <div className={`${shared.display} ${s.root}`} onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}>
      <div className={s.top}>
        <span className={s.site}>{site || "未命名账号"}</span>
        {note && <span className={s.note}>{note}</span>}
      </div>
      <div className={s.creds}>
        {user && <span className={s.user}>{user}</span>}
        {pass && <span className={s.pass}>密码：••••••••</span>}
      </div>
      {!site && !user && !pass && !note && <span className={shared.muted}>空账号，点击填写</span>}
      <span className={shared.editHint} contentEditable={false}>
        点击编辑
      </span>
    </div>
  );
}
