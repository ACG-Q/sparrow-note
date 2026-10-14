import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const anniversaryConfig = {
  type: "anniversary",
  propSchema: {
    ...defaultProps,
    title: { default: "" },
    date: { default: "" },
  },
  content: "none",
} as const;

export type AnniversaryProps = ReactCustomBlockRenderProps<typeof anniversaryConfig>;
export type AnniversaryBlockT = AnniversaryProps["block"];
export type AnniversaryEditor = AnniversaryProps["editor"];
