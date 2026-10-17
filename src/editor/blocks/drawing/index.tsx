import { useEffect } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { BlockIcon, PencilIcon, TrashIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
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

  useEffect(() => {
    if (block.props.data) return;
    openEdit();
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.props.data]);

  if (!block.props.data) {
    return (
      <BlockCard chip={<BlockIcon type="drawing" />} active onClick={openEdit}>
        <span className={shared.empty}>正在打开画板…</span>
      </BlockCard>
    );
  }

  return (
    <BlockCard
      chip={<BlockIcon type="drawing" />}
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
