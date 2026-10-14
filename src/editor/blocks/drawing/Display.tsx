import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { DrawingBlockT, DrawingEditor } from "./config";

export default function DrawingDisplay({
  block,
  editor,
  onEdit,
}: {
  block: DrawingBlockT;
  editor: DrawingEditor;
  onEdit: () => void;
}) {
  return (
    <div className={`${shared.display} ${s.root}`} contentEditable={false}>
      <img className={s.img} src={block.props.data} alt="手绘" />
      <div className={s.actions}>
        <button
          type="button"
          className={s.btn}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onEdit}
        >
          编辑
        </button>
        <button
          type="button"
          className={s.btn}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.updateBlock(block, { props: { data: "" } })}
        >
          删除
        </button>
      </div>
    </div>
  );
}
