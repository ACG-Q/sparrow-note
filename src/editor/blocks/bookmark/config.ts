import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const bookmarkConfig = {
  type: "bookmark",
  propSchema: {
    ...defaultProps,
    title: { default: "" },
    url: { default: "" },
    newTab: { default: true },
  },
  content: "none",
} as const;

export type BookmarkProps = ReactCustomBlockRenderProps<typeof bookmarkConfig>;
export type BookmarkBlockT = BookmarkProps["block"];
export type BookmarkEditor = BookmarkProps["editor"];
