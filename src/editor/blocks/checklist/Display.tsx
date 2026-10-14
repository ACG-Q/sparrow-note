import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { parseItems, type ChecklistBlockT, type ChecklistEditor } from "./config";

export default function ChecklistDisplay({
  block,
  editor,
  onEdit,
}: {
  block: ChecklistBlockT;
  editor: ChecklistEditor;
  onEdit: () => void;
}) {
  const items = parseItems(block.props.items);
  const save = (next: typeof items) => {
    editor.updateBlock(block, { props: { items: JSON.stringify(next) } });
  };
  return (
    <div className={`${shared.display} ${s.root}`} onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}>
      {items.length === 0 && <div className={s.empty}>空清单，点击编辑添加</div>}
      {items.map((it, i) => (
        <div className={s.row} key={i}>
          <input
            type="checkbox"
            checked={it.d}
            onChange={() => save(items.map((x, j) => (j === i ? { ...x, d: !x.d } : x)))}
            contentEditable={false}
            onClick={(e) => e.stopPropagation()}
          />
          <span className={it.d ? `${s.text} ${s.done}` : s.text}>{it.t || "（空项）"}</span>
        </div>
      ))}
      <span className={shared.editHint} contentEditable={false}>
        点击编辑
      </span>
    </div>
  );
}
