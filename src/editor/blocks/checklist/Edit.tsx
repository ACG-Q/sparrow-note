import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { EditBar, stopMouseDown } from "../_shared/BlockShell";
import { parseItems, type ChecklistBlockT, type ChecklistEditor } from "./config";

export default function ChecklistEdit({
  block,
  editor,
  onDone,
}: {
  block: ChecklistBlockT;
  editor: ChecklistEditor;
  onDone: () => void;
}) {
  const items = parseItems(block.props.items);
  const save = (next: typeof items) => {
    editor.updateBlock(block, { props: { items: JSON.stringify(next) } });
  };
  return (
    <div className={shared.form} contentEditable={false}>
      {items.length === 0 && <div className={s.empty}>空清单，点击下方添加</div>}
      {items.map((it, i) => (
        <div className={s.row} key={i}>
          <input
            type="checkbox"
            checked={it.d}
            onChange={() => save(items.map((x, j) => (j === i ? { ...x, d: !x.d } : x)))}
            contentEditable={false}
          />
          <input
            className={it.d ? `${s.input} ${s.done}` : s.input}
            placeholder="待办事项"
            value={it.t}
            onChange={(e) => save(items.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))}
            onMouseDown={stopMouseDown}
          />
          <button
            type="button"
            className={s.del}
            contentEditable={false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => save(items.filter((_, j) => j !== i))}
            aria-label="删除该项"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={s.add}
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => save([...items, { t: "", d: false }])}
      >
        ＋ 添加一项
      </button>
      <EditBar onDone={onDone} />
    </div>
  );
}
