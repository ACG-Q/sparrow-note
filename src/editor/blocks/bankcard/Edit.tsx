import s from "./styles.module.css";
import { EditBar, stopMouseDown } from "../_shared/BlockShell";
import type { BankcardBlockT, BankcardEditor } from "./config";

export default function BankcardEdit({
  block,
  editor,
  onDone,
}: {
  block: BankcardBlockT;
  editor: BankcardEditor;
  onDone: () => void;
}) {
  const set = (key: "bank" | "no" | "holder") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  return (
    <div className={s.editRoot} contentEditable={false}>
      <div className={s.top}>
        <input className={`${s.input} ${s.bankInput}`} placeholder="银行名称" value={block.props.bank} onChange={set("bank")} onMouseDown={stopMouseDown} />
        <select
          className={s.kindSelect}
          value={block.props.kind}
          onChange={(e) => editor.updateBlock(block, { props: { kind: e.target.value as typeof block.props.kind } })}
          onMouseDown={stopMouseDown}
        >
          <option value="储蓄卡">储蓄卡</option>
          <option value="信用卡">信用卡</option>
          <option value="其他">其他</option>
        </select>
      </div>
      <input className={`${s.input} ${s.noInput}`} placeholder="卡号" value={block.props.no} onChange={set("no")} onMouseDown={stopMouseDown} />
      <input className={`${s.input} ${s.holderInput}`} placeholder="持卡人" value={block.props.holder} onChange={set("holder")} onMouseDown={stopMouseDown} />
      <EditBar onDone={onDone} />
    </div>
  );
}
