import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { stopMouseDown } from "../_shared/BlockShell";
import type { AnniversaryBlockT, AnniversaryEditor } from "./config";

export default function AnniversaryEdit({
  block,
  editor,
}: {
  block: AnniversaryBlockT;
  editor: AnniversaryEditor;
}) {
  return (
    <div className={shared.form}>
      <input
        className={`${shared.input} ${s.titleInput}`}
        placeholder="名称"
        value={block.props.title}
        onChange={(e) => editor.updateBlock(block, { props: { title: e.target.value } })}
        onMouseDown={stopMouseDown}
      />
      <input
        className={`${shared.input} ${s.dateInput}`}
        type="date"
        value={block.props.date}
        onChange={(e) => editor.updateBlock(block, { props: { date: e.target.value } })}
        onMouseDown={stopMouseDown}
      />
    </div>
  );
}
