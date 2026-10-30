import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon, TrashIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { useAutoEditOnEmpty } from "../_shared/useAutoEditOnEmpty";
import { ActionBtn, BlockCard, useStartEmpty } from "../_shared/BlockShell";
import { locationConfig, type LocationProps } from "./config";
import LocationDisplay from "./Display";

function LocationRender({ block, editor }: LocationProps) {
  const { pending, open, close } = useBlockEdit();
  const startEmpty = useStartEmpty(block.props.name, block.props.addr, block.props.coord);
  const openEdit = () =>
    open({
      blockId: block.id,
      container: "side",
      type: "location",
      label: "地点",
      iconType: "location",
    });

  useAutoEditOnEmpty(startEmpty, openEdit, close);

  return (
    <BlockCard
      active={pending?.blockId === block.id}
      onClick={openEdit}
      actions={
          <>
            <ActionBtn icon={<PencilIcon />} label="编辑地点" onClick={openEdit} />
            <ActionBtn
              icon={<TrashIcon />}
              label="删除地点"
              danger
              onClick={() => editor.removeBlocks([block])}
            />
          </>
        }
    >
      <LocationDisplay block={block} />
    </BlockCard>
  );
}

export const LocationBlock = createReactBlockSpec(locationConfig, {
  render: (props) => <LocationRender {...props} />,
});
