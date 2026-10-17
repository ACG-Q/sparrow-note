import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { amapLink, type LocationBlockT } from "./config";

export default function LocationDisplay({ block }: { block: LocationBlockT }) {
  const { name, addr, coord } = block.props;
  if (!name && !addr) {
    return <span className={shared.empty}>点击获取位置</span>;
  }
  return (
    <div className={s.body}>
      <span className={s.name}>{name || "未命名地点"}</span>
      {addr && <span className={s.addr}>{addr}</span>}
      {name && (
        <a
          className={s.openRow}
          href={amapLink(name, addr, coord)}
          target="_blank"
          rel="noreferrer noopener"
          contentEditable={false}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
            <path d="M10 17s5.25-4.4 5.25-8.25A5.25 5.25 0 0 0 4.75 8.75C4.75 12.6 10 17 10 17z" />
            <circle cx="10" cy="8.75" r="1.9" />
          </svg>
          在地图中打开
        </a>
      )}
    </div>
  );
}
