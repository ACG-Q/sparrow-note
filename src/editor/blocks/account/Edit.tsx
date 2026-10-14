import { useState } from "react";
import { EyeIcon } from "../../icons";
import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { EditBar, stopMouseDown } from "../_shared/BlockShell";
import type { AccountBlockT, AccountEditor } from "./config";

export default function AccountEdit({
  block,
  editor,
  onDone,
}: {
  block: AccountBlockT;
  editor: AccountEditor;
  onDone: () => void;
}) {
  const [showPass, setShowPass] = useState(false);
  const set = (key: "site" | "user" | "pass" | "note") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  return (
    <div className={s.editRoot} contentEditable={false}>
      <div className={s.editRow}>
        <input className={shared.input} placeholder="网站 / 应用" value={block.props.site} onChange={set("site")} onMouseDown={stopMouseDown} />
        <input className={shared.input} placeholder="账号" value={block.props.user} onChange={set("user")} onMouseDown={stopMouseDown} />
      </div>
      <div className={s.editRow}>
        <input
          className={shared.input}
          type={showPass ? "text" : "password"}
          placeholder="密码"
          value={block.props.pass}
          onChange={set("pass")}
          onMouseDown={stopMouseDown}
        />
        <button
          type="button"
          className={s.eye}
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowPass((v) => !v)}
          aria-label={showPass ? "隐藏密码" : "显示密码"}
        >
          <EyeIcon off={showPass} />
        </button>
      </div>
      <input className={`${shared.input} ${s.noteInput}`} placeholder="备注（可选）" value={block.props.note} onChange={set("note")} onMouseDown={stopMouseDown} />
      <EditBar onDone={onDone} />
    </div>
  );
}
