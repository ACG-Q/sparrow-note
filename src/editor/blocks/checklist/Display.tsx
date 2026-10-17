import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { parseItems, type ChecklistBlockT, type ChecklistEditor } from "./config";

export default function ChecklistDisplay({
  block,
  editor,
}: {
  block: ChecklistBlockT;
  editor: ChecklistEditor;
}) {
  const items = parseItems(block.props.items);
  const save = (next: typeof items) => {
    editor.updateBlock(block, { props: { items: JSON.stringify(next) } });
  };
  if (items.length === 0) {
    return <div className={shared.empty}>点击添加清单项</div>;
  }
  return (
    <>
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
    </>
  );
}
