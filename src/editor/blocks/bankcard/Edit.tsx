import shared from "../_shared/blockCommon.module.css";
import { stopMouseDown } from "../_shared/BlockShell";
import type { BankcardBlockT, BankcardEditor } from "./config";

export default function BankcardEdit({
  block,
  editor,
}: {
  block: BankcardBlockT;
  editor: BankcardEditor;
}) {
  const set = (key: "bank" | "no" | "holder") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  return (
    <div className={shared.form}>
      <input className={shared.input} placeholder="银行名称" value={block.props.bank} onChange={set("bank")} onMouseDown={stopMouseDown} />
      <select
        className={shared.input}
        value={block.props.kind}
        onChange={(e) => editor.updateBlock(block, { props: { kind: e.target.value as typeof block.props.kind } })}
        onMouseDown={stopMouseDown}
      >
        <option value="储蓄卡">储蓄卡</option>
        <option value="信用卡">信用卡</option>
        <option value="其他">其他</option>
      </select>
      <input className={shared.input} placeholder="卡号" value={block.props.no} onChange={set("no")} onMouseDown={stopMouseDown} />
      <input className={shared.input} placeholder="持卡人" value={block.props.holder} onChange={set("holder")} onMouseDown={stopMouseDown} />
    </div>
  );
}
