import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";
import { wgs84ToGcj02 } from "./geo";

export const locationConfig = {
  type: "location",
  propSchema: {
    ...defaultProps,
    name: { default: "" },
    addr: { default: "" },
    coord: { default: "" },
  },
  content: "none",
} as const;

export type LocationProps = ReactCustomBlockRenderProps<typeof locationConfig>;
export type LocationBlockT = LocationProps["block"];
export type LocationEditor = LocationProps["editor"];



const COORD_RE = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

/** 高德要 GCJ-02：存的是 WGS-84，跳转前转一次 */
export function amapLink(name: string, addr: string, coord?: string): string {
  if (coord && COORD_RE.test(coord)) {
    const [lat, lng] = coord.split(",").map((x) => Number(x.trim()));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const g = wgs84ToGcj02({ lat, lon: lng });
      return `https://uri.amap.com/marker?position=${g.lon.toFixed(6)},${g.lat.toFixed(6)}&name=${encodeURIComponent(name || addr || "位置")}`;
    }
  }
  const keyword = `${name} ${addr}`.trim();
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}`;
}
