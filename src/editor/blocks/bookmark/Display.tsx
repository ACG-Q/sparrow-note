import { LinkIcon } from "../../icons";
import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { BookmarkBlockT } from "./config";

export default function BookmarkDisplay({
  block,
  onEdit,
}: {
  block: BookmarkBlockT;
  onEdit: () => void;
}) {
  const { title, url } = block.props;
  const valid = /^https?:\/\//i.test(url);
  return (
    <div className={`${shared.display} ${s.root}`} onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}>
      <span className={s.icon} contentEditable={false}>
        <LinkIcon />
      </span>
      <div className={s.body}>
        <span className={s.title}>{title || "未命名链接"}</span>
        {url && <span className={s.url}>{url}</span>}
      </div>
      {valid && (
        <a className={s.open} href={url} target="_blank" rel="noreferrer noopener" contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
          打开
        </a>
      )}
      <span className={shared.editHint} contentEditable={false}>
        点击编辑
      </span>
    </div>
  );
}
