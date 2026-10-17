import s from "./styles.module.css";
import { THEME_CLASS, maskNo, type BankcardBlockT } from "./config";

export default function BankcardDisplay({ block }: { block: BankcardBlockT }) {
  const { bank, no, holder, kind, theme } = block.props;
  return (
    <div className={THEME_CLASS[theme as keyof typeof THEME_CLASS]}>
      <div className={s.top}>
        <span className={s.bank}>{bank || "点击填写银行"}</span>
        <span className={s.kind}>{kind}</span>
      </div>
      <div className={s.no}>{no ? maskNo(no) : "•••• •••• •••• ••••"}</div>
      <div className={s.holder}>{holder || "点击填写持卡人"}</div>
    </div>
  );
}
