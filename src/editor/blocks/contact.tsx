import { createReactBlockSpec, ReactCustomBlockRenderProps } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";

const contactConfig = {
  type: "contact",
  propSchema: {
    ...defaultProps,
    name: { default: "" },
    phone: { default: "" },
    relation: { default: "" },
  },
  content: "none",
} as const;

type ContactProps = ReactCustomBlockRenderProps<typeof contactConfig>;

function ContactRender({ block, editor }: ContactProps) {
  const set = (key: "name" | "phone" | "relation") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      editor.updateBlock(block, { props: { [key]: e.target.value } });
    };
  return (
    <div className="bn-contact">
      <div className="bn-contact-row">
        <input
          className="bn-input"
          placeholder="姓名"
          value={block.props.name}
          onChange={set("name")}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <input
          className="bn-input"
          placeholder="电话"
          value={block.props.phone}
          onChange={set("phone")}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <input
          className="bn-input bn-input-narrow"
          placeholder="关系"
          value={block.props.relation}
          onChange={set("relation")}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

export const ContactBlock = createReactBlockSpec(contactConfig, {
  render: (props) => <ContactRender {...props} />,
});
