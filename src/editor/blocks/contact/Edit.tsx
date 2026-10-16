import shared from "../_shared/blockCommon.module.css";
import { stopMouseDown } from "../_shared/BlockShell";
import type { ContactBlockT, ContactEditor } from "./config";

export default function ContactEdit({
  block,
  editor,
}: {
  block: ContactBlockT;
  editor: ContactEditor;
}) {
  const set = (key: "name" | "phone" | "relation") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  return (
    <div className={shared.form}>
      <div className={shared.formRow}>
        <input className={shared.input} placeholder="姓名" value={block.props.name} onChange={set("name")} onMouseDown={stopMouseDown} />
        <input className={shared.input} placeholder="电话" value={block.props.phone} onChange={set("phone")} onMouseDown={stopMouseDown} />
        <input className={`${shared.input} ${shared.inputNarrow}`} placeholder="关系" value={block.props.relation} onChange={set("relation")} onMouseDown={stopMouseDown} />
      </div>
    </div>
  );
}
