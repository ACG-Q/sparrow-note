import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon, TrashIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { useAutoEditOnEmpty } from "../_shared/useAutoEditOnEmpty";
import { ActionBtn, useStartEmpty } from "../_shared/BlockShell";
import { useSettings } from "../../../lib/settings";
import s from "./styles.module.css";
import { THEME_CLASS, bankcardConfig, type BankcardProps } from "./config";
import BankcardDisplay from "./Display";

function BankcardRender({ block, editor }: BankcardProps) {
  const { pending, open, close } = useBlockEdit();
  const settings = useSettings();
  const [override, setOverride] = useState<boolean | null>(null);
  const revealed = override ?? settings.showCardNumber;
  const startEmpty = useStartEmpty(block.props.bank, block.props.no, block.props.holder);
  const openEdit = () =>
    open({
      blockId: block.id,
      container: "side",
      type: "bankcard",
      label: "银行卡",
      iconType: "bankcard",
    });

  useAutoEditOnEmpty(startEmpty, openEdit, close);

  return (
    <div className={s.wrap} onClick={openEdit} role="button" tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") openEdit();
      }}
    >
      <div
        className={[s.root, THEME_CLASS[block.props.theme as keyof typeof THEME_CLASS], pending?.blockId === block.id ? s.active : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <BankcardDisplay
          block={block}
          revealed={revealed}
          onToggleReveal={() => setOverride(!revealed)}
        />
      </div>
      <span className={s.actions} contentEditable={false}>
        <ActionBtn
          icon={<PencilIcon />}
          label="编辑银行卡"
          light
          onClick={openEdit}
        />
        <ActionBtn
          icon={<TrashIcon />}
          label="删除银行卡"
          light
          danger
          onClick={() => editor.removeBlocks([block])}
        />
      </span>
    </div>
  );
}

export const BankcardBlock = createReactBlockSpec(bankcardConfig, {
  render: (props) => <BankcardRender {...props} />,
});
