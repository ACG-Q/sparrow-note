import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

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

export type Poi = { name: string; addr: string; coord: string; dist: string };

export const MOCK_POIS: Poi[] = [
  { name: "故宫博物院", addr: "北京市东城区景山前街 4 号", coord: "39.9163, 116.3972", dist: "120m" },
  { name: "景山公园", addr: "北京市西城区景山西街 44 号", coord: "39.9246, 116.3968", dist: "350m" },
  { name: "神武门", addr: "北京市东城区景山前街", coord: "39.9253, 116.3962", dist: "480m" },
];

const COORD_RE = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

export function amapLink(name: string, addr: string, coord?: string): string {
  if (coord && COORD_RE.test(coord)) {
    const [lat, lng] = coord.split(",").map((x) => x.trim());
    return `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodeURIComponent(name || addr || "位置")}`;
  }
  const keyword = `${name} ${addr}`.trim();
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}`;
}
