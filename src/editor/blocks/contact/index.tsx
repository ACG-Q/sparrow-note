import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { contactConfig, type ContactProps } from "./config";
import ContactDisplay from "./Display";
import ContactEdit from "./Edit";

function ContactRender({ block, editor }: ContactProps) {
  const [editing, setEditing] = useState(
    () => !(block.props.name || block.props.phone || block.props.relation),
  );
  if (editing) {
    return <ContactEdit block={block} editor={editor} onDone={() => setEditing(false)} />;
  }
  return <ContactDisplay block={block} onEdit={() => setEditing(true)} />;
}

export const ContactBlock = createReactBlockSpec(contactConfig, {
  render: (props) => <ContactRender {...props} />,
});
