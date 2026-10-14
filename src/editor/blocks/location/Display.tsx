import { PinIcon } from "../../icons";
import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { amapLink, type LocationBlockT } from "./config";

export default function LocationDisplay({
  block,
  onEdit,
}: {
  block: LocationBlockT;
  onEdit: () => void;
}) {
  const { name, addr } = block.props;
  const keyword = `${name} ${addr}`.trim();
  return (
    <div className={`${shared.display} ${s.root}`} onClick={onEdit} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onEdit(); }}>
      <span className={s.pin} contentEditable={false}>
        <PinIcon />
      </span>
      <div className={s.body}>
        <span className={s.name}>{name || "未命名地点"}</span>
        {addr && <span className={s.addr}>{addr}</span>}
      </div>
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
      <span className={shared.editHint} contentEditable={false}>
        点击编辑
      </span>
    </div>
  );
}
