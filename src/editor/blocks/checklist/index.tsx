import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { checklistConfig, parseItems, type ChecklistProps } from "./config";
import ChecklistDisplay from "./Display";
import ChecklistEdit from "./Edit";

function ChecklistRender({ block, editor }: ChecklistProps) {
  const [editing, setEditing] = useState(() => parseItems(block.props.items).length === 0);
  if (editing) {
    return <ChecklistEdit block={block} editor={editor} onDone={() => setEditing(false)} />;
  }
  return <ChecklistDisplay block={block} editor={editor} onEdit={() => setEditing(true)} />;
}

export const ChecklistBlock = createReactBlockSpec(checklistConfig, {
  render: (props) => <ChecklistRender {...props} />,
});
