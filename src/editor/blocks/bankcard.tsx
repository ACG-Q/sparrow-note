import { createReactBlockSpec, ReactCustomBlockRenderProps } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";

const bankcardConfig = {
  type: "bankcard",
  propSchema: {
    ...defaultProps,
    bank: { default: "" },
    no: { default: "" },
    holder: { default: "" },
    kind: { default: "储蓄卡", values: ["储蓄卡", "信用卡", "其他"] },
  },
  content: "none",
} as const;

type BankcardProps = ReactCustomBlockRenderProps<typeof bankcardConfig>;

function BankcardRender({ block, editor }: BankcardProps) {
  const set = (key: "bank" | "no" | "holder") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      editor.updateBlock(block, { props: { [key]: e.target.value } });
    };
  return (
    <div className="bn-bankcard" contentEditable={false}>
      <div className="bn-bankcard-top">
        <input
          className="bn-bankcard-input bn-bankcard-bank"
          placeholder="银行名称"
          value={block.props.bank}
          onChange={set("bank")}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <select
          className="bn-bankcard-kind"
          value={block.props.kind}
          onChange={(e) =>
            editor.updateBlock(block, {
              props: { kind: e.target.value as typeof block.props.kind },
            })
          }
          onMouseDown={(e) => e.stopPropagation()}
        >
          <option value="储蓄卡">储蓄卡</option>
          <option value="信用卡">信用卡</option>
          <option value="其他">其他</option>
        </select>
      </div>
      <input
        className="bn-bankcard-input bn-bankcard-no"
        placeholder="卡号"
        value={block.props.no}
        onChange={set("no")}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <input
        className="bn-bankcard-input bn-bankcard-holder"
        placeholder="持卡人"
        value={block.props.holder}
        onChange={set("holder")}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export const BankcardBlock = createReactBlockSpec(bankcardConfig, {
  render: (props) => <BankcardRender {...props} />,
});
