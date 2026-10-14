import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { drawingConfig, type DrawingProps } from "./config";
import DrawingDisplay from "./Display";
import DrawingEdit from "./Edit";

function DrawingRender({ block, editor }: DrawingProps) {
  const [editing, setEditing] = useState(!block.props.data);
  if (editing) {
    return <DrawingEdit block={block} editor={editor} onDone={() => setEditing(false)} />;
  }
  return <DrawingDisplay block={block} editor={editor} onEdit={() => setEditing(true)} />;
}

export const DrawingBlock = createReactBlockSpec(drawingConfig, {
  render: (props) => <DrawingRender {...props} />,
});
