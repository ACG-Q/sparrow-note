import { createReactBlockSpec, ReactCustomBlockRenderProps } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { daysUntil } from "../../lib/aggregate";

const anniversaryConfig = {
  type: "anniversary",
  propSchema: {
    ...defaultProps,
    title: { default: "" },
    date: { default: "" },
  },
  content: "none",
} as const;

type AnniversaryProps = ReactCustomBlockRenderProps<typeof anniversaryConfig>;

function AnniversaryRender({ block, editor }: AnniversaryProps) {
  const days = daysUntil(block.props.date);
  return (
    <div className="bn-anniversary">
      <input
        className="bn-input bn-input-title"
        placeholder="名称"
        value={block.props.title}
        onChange={(e) => editor.updateBlock(block, { props: { title: e.target.value } })}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <input
        className="bn-input bn-input-date"
        type="date"
        value={block.props.date}
        onChange={(e) => editor.updateBlock(block, { props: { date: e.target.value } })}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {days !== null && (
        <span className={days > 0 && days <= 7 ? "bn-countdown urgent" : "bn-countdown"}>
          {days > 0 ? `还有 ${days} 天` : days === 0 ? "就是今天" : `第 ${-days + 1} 天`}
        </span>
      )}
    </div>
  );
}

export const AnniversaryBlock = createReactBlockSpec(anniversaryConfig, {
  render: (props) => <AnniversaryRender {...props} />,
});
