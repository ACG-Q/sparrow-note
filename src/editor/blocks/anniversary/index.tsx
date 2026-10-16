import { useEffect } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { BlockIcon, PencilIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { ActionBtn, BlockCard, useStartEmpty } from "../_shared/BlockShell";
import { anniversaryConfig, type AnniversaryProps } from "./config";
import AnniversaryDisplay from "./Display";

function AnniversaryRender({ block }: AnniversaryProps) {
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

  useEffect(() => {
    if (!startEmpty) return;
    openEdit();
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BlockCard
      chip={<BlockIcon type="anniversary" />}
      active={pending?.blockId === block.id}
      onClick={openEdit}
      actions={<ActionBtn icon={<PencilIcon />} label="编辑日子" onClick={openEdit} />}
    >
      <AnniversaryDisplay block={block} />
    </BlockCard>
  );
}

export const AnniversaryBlock = createReactBlockSpec(anniversaryConfig, {
  render: (props) => <AnniversaryRender {...props} />,
});
