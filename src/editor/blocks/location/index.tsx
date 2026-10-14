import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { locationConfig, type LocationProps } from "./config";
import LocationDisplay from "./Display";
import LocationEdit from "./Edit";

function LocationRender({ block, editor }: LocationProps) {
  const [editing, setEditing] = useState(() => !(block.props.name || block.props.addr));
  if (editing) {
    return <LocationEdit block={block} editor={editor} onDone={() => setEditing(false)} />;
  }
  return <LocationDisplay block={block} onEdit={() => setEditing(true)} />;
}

export const LocationBlock = createReactBlockSpec(locationConfig, {
  render: (props) => <LocationRender {...props} />,
});
