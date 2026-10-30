import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon, TrashIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { useAutoEditOnEmpty } from "../_shared/useAutoEditOnEmpty";
import { ActionBtn, BlockCard } from "../_shared/BlockShell";
import shared from "../_shared/blockCommon.module.css";
import { drawingConfig, type DrawingProps } from "./config";
import DrawingDisplay from "./Display";

function DrawingRender({ block, editor }: DrawingProps) {
  const { pending, open, close } = useBlockEdit();
  const openEdit = () =>
    open({
      blockId: block.id,
      container: "modal",
      type: "drawing",
      label: "绘图",
      iconType: "drawing",
    });

  useAutoEditOnEmpty(!block.props.data, openEdit, close);

  if (!block.props.data) {
    return (
      <BlockCard active onClick={openEdit}>
        <span className={shared.empty}>正在打开画板…</span>
      </BlockCard>
    );
  }

  return (
    <BlockCard
      active={pending?.blockId === block.id}
      onClick={openEdit}
      actions={
        <>
          <ActionBtn icon={<PencilIcon />} label="编辑绘图" onClick={openEdit} />
          <ActionBtn
            icon={<TrashIcon />}
            label="删除绘图"
            danger
            onClick={() => editor.updateBlock(block, { props: { data: "" } })}
          />
        </>
      }
    >
      <DrawingDisplay block={block} />
    </BlockCard>
  );
}

export const DrawingBlock = createReactBlockSpec(drawingConfig, {
  render: (props) => <DrawingRender {...props} />,
});
