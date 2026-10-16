import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { stopMouseDown } from "../_shared/BlockShell";
import { type BookmarkBlockT, type BookmarkEditor } from "./config";

export default function BookmarkEdit({
  block,
  editor,
}: {
  block: BookmarkBlockT;
  editor: BookmarkEditor;
}) {
  const set = (key: "title" | "url") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  const valid = /^https?:\/\//i.test(block.props.url);
  return (
    <div className={shared.form}>
      <input className={shared.input} placeholder="链接标题" value={block.props.title} onChange={set("title")} onMouseDown={stopMouseDown} />
      <input className={shared.input} placeholder="https://…" value={block.props.url} onChange={set("url")} onMouseDown={stopMouseDown} />
      {valid && (
        <a
          className={s.open}
          href={block.props.url}
          target="_blank"
          rel="noreferrer noopener"
          onMouseDown={stopMouseDown}
        >
          打开链接
        </a>
      )}
    </div>
  );
}
