import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const locationConfig = {
  type: "location",
  propSchema: {
    ...defaultProps,
    name: { default: "" },
    addr: { default: "" },
  },
  content: "none",
} as const;

export type LocationProps = ReactCustomBlockRenderProps<typeof locationConfig>;
export type LocationBlockT = LocationProps["block"];
export type LocationEditor = LocationProps["editor"];

export function amapLink(name: string, addr: string): string {
  const keyword = `${name} ${addr}`.trim();
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}`;
}
