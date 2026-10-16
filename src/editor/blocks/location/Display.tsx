import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { amapLink, type LocationBlockT } from "./config";

export default function LocationDisplay({ block }: { block: LocationBlockT }) {
  const { name, addr } = block.props;
  const keyword = `${name} ${addr}`.trim();
  if (!name && !addr) {
    return <span className={shared.empty}>点击填写地点</span>;
  }
  return (
    <div className={s.body}>
      <span className={s.name}>{name || "未命名地点"}</span>
      {addr && <span className={s.addr}>{addr}</span>}
      {keyword && (
        <a
          className={s.map}
          href={amapLink(name, addr)}
          target="_blank"
          rel="noreferrer noopener"
          contentEditable={false}
          onMouseDown={(e) => e.stopPropagation()}
        >
          地图
        </a>
      )}
    </div>
  );
}
