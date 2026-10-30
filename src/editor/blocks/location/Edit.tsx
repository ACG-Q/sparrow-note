import { useEffect, useRef, useState } from "react";
import { PinIcon } from "../../icons";
import s from "./styles.module.css";
import { PanelSection, Rows, Row, RowInput } from "../_shared/panelKit";
import {
  currentPosition,
  formatCoord,
  inDesktopShell,
  mapView,
  parseCoord,
  reverseGeocode,
  searchPlaces,
  type Coord,
  type PlaceHit,
} from "./geo";
import { amapLink, type LocationBlockT, type LocationEditor } from "./config";
import { useSettings } from "../../../lib/settings";

type Phase = "idle" | "locating" | "done" | "error";

/** 桌面壳里 WebView 没有定位权限，文案不能骗人说要「去系统里允许」 */
function failText(code: string, inShell: boolean): string {
  const map: Record<string, string> = {
    "desktop-unsupported": "Windows 版暂不支持精确定位，用下面的「搜地点」按地名查。",
    unsupported: inShell
      ? "这台设备没有定位接口，用下面的「搜地点」或手填。"
      : "浏览器不支持定位，用下面的「搜地点」或手填。",
    denied: inShell
      ? "定位权限被拒绝。设置 → 隐私和安全性 → 位置，允许桌面应用访问后重试。"
      : "定位权限被拒绝，在浏览器地址栏里重新允许后重试。",
    timeout: "定位超时——室内常常如此，换个位置再试。",
    unavailable: "暂时拿不到坐标，稍后再试，或用下面的「搜地点」。",
  };
  return map[code] ?? map.unavailable;
}

export default function LocationEdit({
  block,
  editor,
}: {
  block: LocationBlockT;
  editor: LocationEditor;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [fail, setFail] = useState<string>("");
  const [geocoding, setGeocoding] = useState(false);
  const [tilesOk, setTilesOk] = useState(0);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const settings = useSettings();
  const searchRef = useRef<HTMLInputElement>(null);
  const desktop = inDesktopShell();

  const coord = parseCoord(block.props.coord);
  const view = coord ? mapView(coord, settings.mapProvider) : null;
  const set = (key: "name" | "addr") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };

  useEffect(() => {
    setTilesOk(0);
  }, [block.props.coord]);

  // 搜索防抖：停手 400ms 再打 Photon，换词时把上一次请求掐掉
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    setSearchFailed(false);
    const timer = setTimeout(() => {
      void searchPlaces(q, 6, ctrl.signal).then((list) => {
        if (ctrl.signal.aborted) return;
        // null = 请求本身失败（限流/断网），和「真的没找到」分开说
        setSearchFailed(list === null);
        setHits(list ?? []);
        setSearching(false);
      });
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
      setSearching(false);
    };
  }, [term]);

  const locate = async () => {
    setPhase("locating");
    setFail("");
    try {
      const pos = await currentPosition();
      const c: Coord = { lat: pos.lat, lon: pos.lon };
      editor.updateBlock(block, { props: { coord: formatCoord(c) } });
      setPhase("done");
      setGeocoding(true);
      const place = await reverseGeocode(c);
      setGeocoding(false);
      if (place) {
        editor.updateBlock(block, {
          props: {
            name: block.props.name || place.name,
            addr: block.props.addr || place.addr,
          },
        });
      }
    } catch (e) {
      setPhase("error");
      const inShell = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
      setFail(failText(e instanceof Error ? e.message : "", inShell));
    }
  };

  const busy = phase === "locating" || geocoding;

  return (
    <>
      <div className={s.mapWrap}>
        {view ? (
          <div className={s.mapBox}>
            <div
              className={s.mapSlide}
              style={{ marginLeft: `${-view.px}px`, marginTop: `${-view.py}px` }}
              aria-hidden="true"
            >
              {view.tiles.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading="lazy"
                  onLoad={() => setTilesOk((n) => n + 1)}
                  style={{ gridColumn: (i % 2) + 1, gridRow: Math.floor(i / 2) + 1 }}
                />
              ))}
            </div>
            <span className={s.mapPin} aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="currentColor" width="26" height="26">
                <path d="M10 18s6-5 6-9.2A6 6 0 0 0 4 8.8C4 13 10 18 10 18z" />
                <circle cx="10" cy="8.6" r="2.2" fill="#fff" />
              </svg>
            </span>
            <span className={s.mapAttr}>{view.attribution}</span>
            {tilesOk === 0 && <span className={s.mapHint}>地图加载中…</span>}
          </div>
        ) : (
          <div className={s.mapEmpty}>
            <PinIcon />
            <span>还没有坐标</span>
          </div>
        )}
        {desktop ? (
          <span className={s.mapUnsupported}>
            <span>Windows 版暂不支持定位</span>
            <button
              type="button"
              className={s.geoLink}
              contentEditable={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => searchRef.current?.focus()}
            >
              用地名搜索 →
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={s.mapLocate}
            contentEditable={false}
            disabled={busy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void locate()}
          >
            <PinIcon />
            {phase === "locating" ? "定位中…" : coord ? "重新定位" : "使用当前位置"}
          </button>
        )}
      </div>

      {phase === "error" && <p className={s.geoFail}>{fail}</p>}
      {geocoding && <p className={s.geoNote}>正在反查地名…</p>}
      {!geocoding && phase === "done" && !block.props.name && (
        <p className={s.geoNote}>已记下坐标，地名可以手填。</p>
      )}

      <PanelSection label="搜地点" hint={desktop ? "桌面版的正路" : "没有 GPS 时走这条"}>
        <input
          ref={searchRef}
          className={s.poiSearch}
          placeholder="输入地名，如 西湖、闻涛路"
          value={term}
          contentEditable={false}
          onChange={(e) => setTerm(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
        />
        {term.trim().length >= 2 && (
          <div className={s.poiList}>
            {searching && <p className={s.geoNote}>搜索中…</p>}
            {!searching && searchFailed && (
              <p className={s.geoFail}>搜索服务没响应（可能被限流），过一会儿再试。</p>
            )}
            {!searching && !searchFailed && hits.length === 0 && (
              <p className={s.geoNote}>没有找到，换个说法试试。</p>
            )}
            {hits.map((hit) => (
              <button
                key={`${hit.name}-${hit.coord.lat}-${hit.coord.lon}`}
                type="button"
                className={
                  block.props.name === hit.name ? `${s.poi} ${s.poiOn}` : s.poi
                }
                contentEditable={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.updateBlock(block, {
                    props: {
                      name: hit.name,
                      addr: hit.addr,
                      coord: formatCoord(hit.coord),
                    },
                  });
                  setTerm("");
                  setHits([]);
                }}
              >
                <span className={s.poiMain}>
                  <span className={s.poiName}>{hit.name}</span>
                  {hit.addr && <span className={s.poiAddr}>{hit.addr}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection label="位置">
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
    </>
  );
}
