import s from "./styles.module.css";
import { groupNo, maskNo, type BankcardBlockT } from "./config";

export default function BankcardDisplay({
  block,
  revealed,
  onToggleReveal,
}: {
  block: BankcardBlockT;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const { bank, no, holder, kind } = block.props;
  const digits = no.replace(/\D/g, "");
  return (
    <>
      <div className={s.top}>
        <span className={s.bank}>{bank || "点击填写银行"}</span>
        <span className={s.kind}>{kind}</span>
      </div>
      <div className={s.no}>
        {digits ? (revealed ? groupNo(digits) : maskNo(digits)) : "•••• •••• •••• ••••"}
      </div>
      <div className={s.bottom}>
        <span className={s.holder}>{holder || "点击填写持卡人"}</span>
        {digits ? (
          <button
            type="button"
            className={s.reveal}
            contentEditable={false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleReveal();
            }}
          >
            {revealed ? "隐藏" : "查看"}
          </button>
        ) : null}
      </div>
    </>
  );
}
