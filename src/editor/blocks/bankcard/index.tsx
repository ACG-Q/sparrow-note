import { useEffect } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon, TrashIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { ActionBtn, useStartEmpty } from "../_shared/BlockShell";
import s from "./styles.module.css";
import { THEME_CLASS, bankcardConfig, type BankcardProps } from "./config";
import BankcardDisplay from "./Display";

function BankcardRender({ block, editor }: BankcardProps) {
  const { pending, open, close } = useBlockEdit();
  const startEmpty = useStartEmpty(block.props.bank, block.props.no, block.props.holder);
  const openEdit = () =>
    open({
      blockId: block.id,
      container: "side",
      type: "bankcard",
      label: "银行卡",
      iconType: "bankcard",
    });

  useEffect(() => {
    if (!startEmpty) return;
    openEdit();
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={[s.root, THEME_CLASS[block.props.theme as keyof typeof THEME_CLASS], pending?.blockId === block.id ? s.active : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={openEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") openEdit();
      }}
    >
      <BankcardDisplay block={block} />
      <span className={s.actions} contentEditable={false}>
        <ActionBtn
          icon={<PencilIcon />}
          label="编辑银行卡"
          light
          onClick={openEdit}
        />
        <ActionBtn
          icon={<TrashIcon />}
          label="清空银行卡"
          light
          danger
          onClick={() =>
            editor.updateBlock(block, { props: { bank: "", no: "", holder: "" } })
          }
        />
      </span>
    </div>
  );
}

export const BankcardBlock = createReactBlockSpec(bankcardConfig, {
  render: (props) => <BankcardRender {...props} />,
});
