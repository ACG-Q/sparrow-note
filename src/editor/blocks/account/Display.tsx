import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { useCopy } from "../_shared/panelKit";
import { useTotp } from "../../../lib/useTotp";
import type { AccountBlockT } from "./config";

export default function AccountDisplay({ block }: { block: AccountBlockT }) {
  const { site, user, pass, totp } = block.props;
  const totpState = useTotp(totp);
  const [copiedCode, copyCode] = useCopy();
  if (!site && !user && !pass) {
    return <span className={shared.empty}>点击填写账号</span>;
  }
  return (
    <>
      <div className={shared.bcBody}>
        <span className={shared.bcTitle}>{site || "未命名账号"}</span>
        {user && <span className={shared.bcMeta}>{user}</span>}
      </div>
      {pass && <div className={s.pass}>密码：••••••••••</div>}
      {totpState && (
        <div
          className={s.totpRow}
          role="button"
          tabIndex={0}
          onClick={() => copyCode(totpState.code)}
          onKeyDown={(e) => {
            if (e.key === "Enter") copyCode(totpState.code);
          }}
        >
          <span className={s.totpCode}>{totpState.code.replace(/(.{3})/g, "$1 ").trim()}</span>
          <span className={s.totpBar}>
            <i style={{ width: `${(totpState.remain / totpState.period) * 100}%` }} />
          </span>
          <span className={s.totpCopy}>{copiedCode ? "已复制" : "复制"}</span>
        </div>
      )}
    </>
  );
}
