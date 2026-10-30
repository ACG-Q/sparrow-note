/** 地图瓦片源。现在只有高德，以后加别的（天地图 / OSM / 自建）只要往这个表里塞一条。 */

export type MapProviderId = "amap";

export interface MapProvider {
  id: MapProviderId;
  /** 在设置里显示的名字 */
  label: string;
  /** 地图右下角的署名，别省——瓦片服务方的要求 */
  attribution: string;
  /** 这门服务的坐标系：国内图商是 GCJ-02，OSM 一类是 WGS-84 */
  coordSystem: "gcj02" | "wgs84";
  /** 最多支持到几级缩放 */
  maxZoom: number;
  /** 拼一块瓦片（x/y 是瓦片网格编号，z 是缩放级别，sub 用来轮换子域） */
  tileUrl: (x: number, y: number, z: number, sub: number) => string;
  /** 设置页里的一句备注 */
  note?: string;
}

const amap: MapProvider = {
  id: "amap",
  label: "高德地图",
  attribution: "© 高德地图",
  coordSystem: "gcj02",
  maxZoom: 18,
  // 免 key 的瓦片端点，子域轮换分摊压力
  tileUrl: (x, y, z, sub) =>
    `https://webrd0${1 + (sub % 3)}.is.autonavi.com/appmaptile` +
    `?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`,
  note: "免 key，瓦片直连。",
};

export const MAP_PROVIDERS: MapProvider[] = [amap];

export const DEFAULT_MAP_PROVIDER: MapProviderId = "amap";

export function getMapProvider(id: string | undefined): MapProvider {
  return MAP_PROVIDERS.find((p) => p.id === id) ?? MAP_PROVIDERS[0];
}
