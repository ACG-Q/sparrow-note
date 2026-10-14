import { createReactBlockSpec, ReactCustomBlockRenderProps } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useState } from "react";
import { EyeIcon } from "../icons";

const accountConfig = {
  type: "account",
  propSchema: {
    ...defaultProps,
    site: { default: "" },
    user: { default: "" },
    pass: { default: "" },
    note: { default: "" },
  },
  content: "none",
} as const;

type AccountProps = ReactCustomBlockRenderProps<typeof accountConfig>;

function AccountRender({ block, editor }: AccountProps) {
  const [showPass, setShowPass] = useState(false);
  const set = (key: "site" | "user" | "pass" | "note") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      editor.updateBlock(block, { props: { [key]: e.target.value } });
    };
  return (
    <div className="bn-account">
      <div className="bn-account-row">
        <input
          className="bn-input"
          placeholder="网站 / 应用"
          value={block.props.site}
          onChange={set("site")}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <input
          className="bn-input"
          placeholder="账号"
          value={block.props.user}
          onChange={set("user")}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
      <div className="bn-account-row">
        <input
          className="bn-input"
          type={showPass ? "text" : "password"}
          placeholder="密码"
          value={block.props.pass}
          onChange={set("pass")}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          className="bn-account-eye"
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowPass((v) => !v)}
          aria-label={showPass ? "隐藏密码" : "显示密码"}
        >
          <EyeIcon off={showPass} />
        </button>
      </div>
      <input
        className="bn-input bn-account-note"
        placeholder="备注（可选）"
        value={block.props.note}
        onChange={set("note")}
        onMouseDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export const AccountBlock = createReactBlockSpec(accountConfig, {
  render: (props) => <AccountRender {...props} />,
});
