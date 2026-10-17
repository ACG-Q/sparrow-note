import { useEffect } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { ActionBtn, BlockCard, useStartEmpty } from "../_shared/BlockShell";
import s from "./styles.module.css";
import { contactConfig, type ContactProps } from "./config";
import ContactDisplay from "./Display";

function ContactRender({ block }: ContactProps) {
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

  useEffect(() => {
    if (!startEmpty) return;
    openEdit();
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BlockCard
      chip={<span>{(block.props.name || "?").slice(0, 1)}</span>}
      chipClassName={s.chipAvatar}
      active={pending?.blockId === block.id}
      onClick={openEdit}
      actions={<ActionBtn icon={<PencilIcon />} label="编辑联系人" onClick={openEdit} />}
    >
      <ContactDisplay block={block} />
    </BlockCard>
  );
}

export const ContactBlock = createReactBlockSpec(contactConfig, {
  render: (props) => <ContactRender {...props} />,
});
