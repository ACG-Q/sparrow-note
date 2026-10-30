import { LinkIcon } from "../../icons";
import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { BookmarkBlockT } from "./config";

export default function BookmarkDisplay({ block }: { block: BookmarkBlockT }) {
  const { title, url, newTab } = block.props;
  const valid = /^https?:\/\//i.test(url);
  if (!title && !url) {
    return <span className={shared.empty}>点击填写书签</span>;
  }
  return (
    <div className={shared.bcBody}>
      <span className={shared.bcTitle}>{title || "未命名链接"}</span>
      {url && <span className={shared.bcMeta}>{url}</span>}
      {valid && (
        <a
          className={s.openRow}
          href={url}
          target={newTab ? "_blank" : "_self"}
          rel="noreferrer noopener"
          contentEditable={false}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <LinkIcon />
          在浏览器中打开
        </a>
      )}
    </div>
  );
}
