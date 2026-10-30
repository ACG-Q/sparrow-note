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
          <button
            type="button"
            role="checkbox"
            aria-checked={it.d}
            aria-label={it.t || "清单项"}
            className={it.d ? `${s.box} ${s.boxOn}` : s.box}
            contentEditable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              save(items.map((x, j) => (j === i ? { ...x, d: !x.d } : x)));
            }}
          >
            {it.d ? "✓" : ""}
          </button>
          <span className={it.d ? `${s.text} ${s.done}` : s.text}>{it.t || "（空项）"}</span>
        </div>
      ))}
    </>
  );
}
