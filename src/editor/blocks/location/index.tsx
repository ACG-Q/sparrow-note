import { useEffect } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { BlockIcon, PencilIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { ActionBtn, BlockCard, useStartEmpty } from "../_shared/BlockShell";
import { locationConfig, type LocationProps } from "./config";
import LocationDisplay from "./Display";

function LocationRender({ block }: LocationProps) {
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

  useEffect(() => {
    if (!startEmpty) return;
    openEdit();
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BlockCard
      chip={<BlockIcon type="location" />}
      active={pending?.blockId === block.id}
      onClick={openEdit}
      actions={<ActionBtn icon={<PencilIcon />} label="编辑地点" onClick={openEdit} />}
    >
      <LocationDisplay block={block} />
    </BlockCard>
  );
}

export const LocationBlock = createReactBlockSpec(locationConfig, {
  render: (props) => <LocationRender {...props} />,
});
