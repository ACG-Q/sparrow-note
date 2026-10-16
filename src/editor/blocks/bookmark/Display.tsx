import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { BookmarkBlockT } from "./config";

export default function BookmarkDisplay({ block }: { block: BookmarkBlockT }) {
  const { title, url } = block.props;
  const valid = /^https?:\/\//i.test(url);
  if (!title && !url) {
    return <span className={shared.empty}>点击填写书签</span>;
  }
  return (
    <div className={s.body}>
      <span className={s.title}>{title || "未命名链接"}</span>
      {url && <span className={s.url}>{url}</span>}
      {valid && (
        <a
          className={s.open}
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          contentEditable={false}
          onMouseDown={(e) => e.stopPropagation()}
        >
          打开
        </a>
      )}
    </div>
  );
}
