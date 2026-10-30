import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon, TrashIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { useAutoEditOnEmpty } from "../_shared/useAutoEditOnEmpty";
import { ActionBtn, BlockCard, useStartEmpty } from "../_shared/BlockShell";
import { contactConfig, type ContactProps } from "./config";
import ContactDisplay from "./Display";

function ContactRender({ block, editor }: ContactProps) {
  const { pending, open, close } = useBlockEdit();
  const startEmpty = useStartEmpty(block.props.name, block.props.phone, block.props.relation);
  const openEdit = () =>
    open({
      blockId: block.id,
      container: "side",
      type: "contact",
      label: "联系人",
      iconType: "contact",
    });

  useAutoEditOnEmpty(startEmpty, openEdit, close);

  return (
    <BlockCard
      active={pending?.blockId === block.id}
      onClick={openEdit}
      actions={
          <>
            <ActionBtn icon={<PencilIcon />} label="编辑联系人" onClick={openEdit} />
            <ActionBtn
              icon={<TrashIcon />}
              label="删除联系人"
              danger
              onClick={() => editor.removeBlocks([block])}
            />
          </>
        }
    >
      <ContactDisplay block={block} />
    </BlockCard>
  );
}

export const ContactBlock = createReactBlockSpec(contactConfig, {
  render: (props) => <ContactRender {...props} />,
});
