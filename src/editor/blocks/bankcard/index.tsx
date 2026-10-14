import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { bankcardConfig, type BankcardProps } from "./config";
import BankcardDisplay from "./Display";
import BankcardEdit from "./Edit";

function BankcardRender({ block, editor }: BankcardProps) {
  const [editing, setEditing] = useState(
    () => !(block.props.bank || block.props.no || block.props.holder),
  );
  if (editing) {
    return <BankcardEdit block={block} editor={editor} onDone={() => setEditing(false)} />;
  }
  return <BankcardDisplay block={block} onEdit={() => setEditing(true)} />;
}

export const BankcardBlock = createReactBlockSpec(bankcardConfig, {
  render: (props) => <BankcardRender {...props} />,
});
