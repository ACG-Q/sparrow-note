import { LinkIcon } from "../../icons";
import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { EditBar, stopMouseDown } from "../_shared/BlockShell";
import type { BookmarkBlockT, BookmarkEditor } from "./config";

export default function BookmarkEdit({
  block,
  editor,
  onDone,
}: {
  block: BookmarkBlockT;
  editor: BookmarkEditor;
  onDone: () => void;
}) {
  const set = (key: "title" | "url") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  const valid = /^https?:\/\//i.test(block.props.url);
  return (
    <div className={s.editRoot} contentEditable={false}>
      <span className={s.icon} contentEditable={false}>
        <LinkIcon />
      </span>
      <div className={s.body}>
        <input className={`${shared.input} ${s.titleInput}`} placeholder="链接标题" value={block.props.title} onChange={set("title")} onMouseDown={stopMouseDown} />
        <input className={`${shared.input} ${s.urlInput}`} placeholder="https://…" value={block.props.url} onChange={set("url")} onMouseDown={stopMouseDown} />
      </div>
      {valid && (
        <a className={s.open} href={block.props.url} target="_blank" rel="noreferrer noopener" onMouseDown={stopMouseDown}>
          打开
        </a>
      )}
      <EditBar onDone={onDone} />
    </div>
  );
}
