import { useEffect } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { ActionBtn, BlockCard, useStartEmpty } from "../_shared/BlockShell";
import s from "./styles.module.css";
import { accountConfig, type AccountProps } from "./config";
import AccountDisplay from "./Display";

function AccountRender({ block }: AccountProps) {
  const { pending, open, close } = useBlockEdit();
  const startEmpty = useStartEmpty(block.props.site, block.props.user, block.props.pass);
  const openEdit = () =>
    open({
      blockId: block.id,
      container: "side",
      type: "account",
      label: "账号",
      iconType: "account",
    });

  useEffect(() => {
    if (!startEmpty) return;
    openEdit();
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BlockCard
      chip={<span>{(block.props.site || "?").slice(0, 1).toUpperCase()}</span>}
      chipClassName={s.chipLogo}
      active={pending?.blockId === block.id}
      onClick={openEdit}
      actions={<ActionBtn icon={<PencilIcon />} label="编辑账号" onClick={openEdit} />}
    >
      <AccountDisplay block={block} />
    </BlockCard>
  );
}

export const AccountBlock = createReactBlockSpec(accountConfig, {
  render: (props) => <AccountRender {...props} />,
});
