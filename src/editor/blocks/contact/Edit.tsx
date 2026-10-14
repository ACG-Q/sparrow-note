import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { EditBar, stopMouseDown } from "../_shared/BlockShell";
import type { ContactBlockT, ContactEditor } from "./config";

export default function ContactEdit({
  block,
  editor,
  onDone,
}: {
  block: ContactBlockT;
  editor: ContactEditor;
  onDone: () => void;
}) {
  const set = (key: "name" | "phone" | "relation") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  return (
    <div className={s.editRoot} contentEditable={false}>
      <div className={s.editRow}>
        <input className={shared.input} placeholder="姓名" value={block.props.name} onChange={set("name")} onMouseDown={stopMouseDown} />
        <input className={shared.input} placeholder="电话" value={block.props.phone} onChange={set("phone")} onMouseDown={stopMouseDown} />
        <input className={`${shared.input} ${shared.inputNarrow}`} placeholder="关系" value={block.props.relation} onChange={set("relation")} onMouseDown={stopMouseDown} />
      </div>
      <EditBar onDone={onDone} />
    </div>
  );
}
