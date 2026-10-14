import { PinIcon } from "../../icons";
import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { EditBar, stopMouseDown } from "../_shared/BlockShell";
import { amapLink, type LocationBlockT, type LocationEditor } from "./config";

export default function LocationEdit({
  block,
  editor,
  onDone,
}: {
  block: LocationBlockT;
  editor: LocationEditor;
  onDone: () => void;
}) {
  const set = (key: "name" | "addr") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  const keyword = `${block.props.name} ${block.props.addr}`.trim();
  return (
    <div className={s.editRoot} contentEditable={false}>
      <span className={s.pin} contentEditable={false}>
        <PinIcon />
      </span>
      <div className={s.body}>
        <input className={`${shared.input} ${s.nameInput}`} placeholder="地点名称" value={block.props.name} onChange={set("name")} onMouseDown={stopMouseDown} />
        <input className={`${shared.input} ${s.addrInput}`} placeholder="地址" value={block.props.addr} onChange={set("addr")} onMouseDown={stopMouseDown} />
      </div>
      {keyword && (
        <a className={s.map} href={amapLink(block.props.name, block.props.addr)} target="_blank" rel="noreferrer noopener" onMouseDown={stopMouseDown}>
          地图
        </a>
      )}
      <EditBar onDone={onDone} />
    </div>
  );
}
