import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const bankcardConfig = {
  type: "bankcard",
  propSchema: {
    ...defaultProps,
    bank: { default: "" },
    no: { default: "" },
    holder: { default: "" },
    kind: { default: "储蓄卡", values: ["储蓄卡", "信用卡", "其他"] },
  },
  content: "none",
} as const;

export type BankcardProps = ReactCustomBlockRenderProps<typeof bankcardConfig>;
export type BankcardBlockT = BankcardProps["block"];
export type BankcardEditor = BankcardProps["editor"];

export function maskNo(no: string): string {
  const digits = no.replace(/\s/g, "");
  if (digits.length <= 4) return digits;
  return `•••• •••• •••• ${digits.slice(-4)}`;
}
