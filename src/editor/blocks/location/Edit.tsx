import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import { stopMouseDown } from "../_shared/BlockShell";
import { amapLink, type LocationBlockT, type LocationEditor } from "./config";

export default function LocationEdit({
  block,
  editor,
}: {
  block: LocationBlockT;
  editor: LocationEditor;
}) {
  const set = (key: "name" | "addr") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  const keyword = `${block.props.name} ${block.props.addr}`.trim();
  return (
    <div className={shared.form}>
      <input className={shared.input} placeholder="地点名称" value={block.props.name} onChange={set("name")} onMouseDown={stopMouseDown} />
      <input className={shared.input} placeholder="地址" value={block.props.addr} onChange={set("addr")} onMouseDown={stopMouseDown} />
      {keyword && (
        <a
          className={s.map}
          href={amapLink(block.props.name, block.props.addr)}
          target="_blank"
          rel="noreferrer noopener"
          onMouseDown={stopMouseDown}
        >
          在地图中打开
        </a>
      )}
    </div>
  );
}
