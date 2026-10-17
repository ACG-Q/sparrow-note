import { useState } from "react";
import { PinIcon } from "../../icons";
import s from "./styles.module.css";
import { PanelSection, Rows, Row, RowInput, GhostLink } from "../_shared/panelKit";
import { MOCK_POIS, amapLink, type LocationBlockT, type LocationEditor } from "./config";

export default function LocationEdit({
  block,
  editor,
}: {
  block: LocationBlockT;
  editor: LocationEditor;
}) {
  const [showPoi, setShowPoi] = useState(!!block.props.name || !!block.props.addr);
  const [manual, setManual] = useState(false);
  const set = (key: "name" | "addr") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  const pick = (name: string, addr: string, coord: string) => {
    editor.updateBlock(block, { props: { name, addr, coord } });
  };
  const selected = block.props.name;
  return (
    <>
      <div className={s.mapWrap}>
        <div className={s.mapTiles}>
          <span className={s.mapPin}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="26" height="26">
              <path d="M10 18s6-5 6-9.2A6 6 0 0 0 4 8.8C4 13 10 18 10 18z" />
              <circle cx="10" cy="8.6" r="2.2" fill="#fff" />
            </svg>
          </span>
          <button
            type="button"
            className={s.mapLocate}
            contentEditable={false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowPoi(true)}
          >
            <PinIcon />
            使用当前位置
          </button>
        </div>
      </div>
      {showPoi && (
        <PanelSection label="附近位置" hint="点选以回填">
          <div className={s.poiList}>
            {MOCK_POIS.map((poi) => (
              <button
                key={poi.name}
                type="button"
                className={selected === poi.name ? `${s.poi} ${s.poiOn}` : s.poi}
                contentEditable={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(poi.name, poi.addr, poi.coord)}
              >
                <span className={s.poiMain}>
                  <span className={s.poiName}>{poi.name}</span>
                  <span className={s.poiAddr}>{poi.addr}</span>
                </span>
                <span className={s.poiDist}>{poi.dist}</span>
              </button>
            ))}
          </div>
        </PanelSection>
      )}
      <PanelSection label="已选位置">
        <Rows>
          <Row label="名称">
            <RowInput placeholder="地点名称" value={block.props.name} onChange={set("name")} />
          </Row>
          <Row label="地址">
            <RowInput placeholder="地址" value={block.props.addr} onChange={set("addr")} />
          </Row>
          <Row label="坐标">
            <RowInput
              placeholder="纬度, 经度"
              value={block.props.coord}
              onChange={(e) => editor.updateBlock(block, { props: { coord: e.target.value } })}
              style={{ color: "var(--fg-muted)" }}
            />
          </Row>
        </Rows>
        {block.props.name && (
          <a
            className={s.openRow}
            href={amapLink(block.props.name, block.props.addr, block.props.coord)}
            target="_blank"
            rel="noreferrer noopener"
            contentEditable={false}
            onMouseDown={(e) => e.preventDefault()}
          >
            在地图中打开
          </a>
        )}
      </PanelSection>
      <GhostLink onClick={() => setManual((v) => !v)}>
        手动填写（定位不可用时）{manual ? "▴" : "▾"}
      </GhostLink>
      {manual && (
        <PanelSection label="手动填写">
          <Rows>
            <Row label="名称">
              <RowInput placeholder="地点名称" value={block.props.name} onChange={set("name")} />
            </Row>
            <Row label="地址">
              <RowInput placeholder="地址" value={block.props.addr} onChange={set("addr")} />
            </Row>
          </Rows>
        </PanelSection>
      )}
    </>
  );
}
