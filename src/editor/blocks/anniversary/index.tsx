import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon, TrashIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { useAutoEditOnEmpty } from "../_shared/useAutoEditOnEmpty";
import { ActionBtn, BlockCard, useStartEmpty } from "../_shared/BlockShell";
import { anniversaryConfig, type AnniversaryProps } from "./config";
import AnniversaryDisplay from "./Display";

function AnniversaryRender({ block, editor }: AnniversaryProps) {
  const { pending, open, close } = useBlockEdit();
  const startEmpty = useStartEmpty(block.props.title, block.props.date);
  const openEdit = () =>
    open({
      blockId: block.id,
      container: "side",
      type: "anniversary",
      label: "日子",
      iconType: "anniversary",
    });

  useAutoEditOnEmpty(startEmpty, openEdit, close);

  return (
    <BlockCard
      active={pending?.blockId === block.id}
      onClick={openEdit}
      actions={
          <>
            <ActionBtn icon={<PencilIcon />} label="编辑日子" onClick={openEdit} />
            <ActionBtn
              icon={<TrashIcon />}
              label="删除日子"
              danger
              onClick={() => editor.removeBlocks([block])}
            />
          </>
        }
    >
      <AnniversaryDisplay block={block} />
    </BlockCard>
  );
}

export const AnniversaryBlock = createReactBlockSpec(anniversaryConfig, {
  render: (props) => <AnniversaryRender {...props} />,
});
