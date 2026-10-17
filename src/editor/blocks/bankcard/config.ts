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
    theme: { default: "blue", values: ["blue", "purple", "teal", "rose"] },
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

export type BankTheme = "blue" | "purple" | "teal" | "rose";

export const THEME_CLASS: Record<BankTheme, string> = {
  blue: "",
  purple: "themePurple",
  teal: "themeTeal",
  rose: "themeRose",
};

export function groupNo(no: string): string {
  const digits = no.replace(/\D/g, "");
  return (digits.match(/.{1,4}/g) ?? []).join(" ");
}
