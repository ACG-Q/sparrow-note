import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const accountConfig = {
  type: "account",
  propSchema: {
    ...defaultProps,
    site: { default: "" },
    user: { default: "" },
    pass: { default: "" },
    note: { default: "" },
  },
  content: "none",
} as const;

export type AccountProps = ReactCustomBlockRenderProps<typeof accountConfig>;
export type AccountBlockT = AccountProps["block"];
export type AccountEditor = AccountProps["editor"];
