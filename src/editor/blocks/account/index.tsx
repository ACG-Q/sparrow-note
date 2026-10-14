import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { accountConfig, type AccountProps } from "./config";
import AccountDisplay from "./Display";
import AccountEdit from "./Edit";

function AccountRender({ block, editor }: AccountProps) {
  const [editing, setEditing] = useState(
    () => !(block.props.site || block.props.user || block.props.pass),
  );
  if (editing) {
    return <AccountEdit block={block} editor={editor} onDone={() => setEditing(false)} />;
  }
  return <AccountDisplay block={block} onEdit={() => setEditing(true)} />;
}

export const AccountBlock = createReactBlockSpec(accountConfig, {
  render: (props) => <AccountRender {...props} />,
});
