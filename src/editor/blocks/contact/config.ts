import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const contactConfig = {
  type: "contact",
  propSchema: {
    ...defaultProps,
    name: { default: "" },
    phone: { default: "" },
    relation: { default: "" },
  },
  content: "none",
} as const;

export type ContactProps = ReactCustomBlockRenderProps<typeof contactConfig>;
export type ContactBlockT = ContactProps["block"];
export type ContactEditor = ContactProps["editor"];
