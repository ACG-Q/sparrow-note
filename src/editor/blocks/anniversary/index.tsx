import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { anniversaryConfig, type AnniversaryProps } from "./config";
import AnniversaryDisplay from "./Display";
import AnniversaryEdit from "./Edit";

function AnniversaryRender({ block, editor }: AnniversaryProps) {
  const [editing, setEditing] = useState(() => !(block.props.title || block.props.date));
  if (editing) {
    return <AnniversaryEdit block={block} editor={editor} onDone={() => setEditing(false)} />;
  }
  return <AnniversaryDisplay block={block} onEdit={() => setEditing(true)} />;
}

export const AnniversaryBlock = createReactBlockSpec(anniversaryConfig, {
  render: (props) => <AnniversaryRender {...props} />,
});
