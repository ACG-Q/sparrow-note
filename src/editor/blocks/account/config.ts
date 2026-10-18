import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const accountConfig = {
  type: "account",
  propSchema: {
    ...defaultProps,
    site: { default: "" },
    url: { default: "" },
    user: { default: "" },
    pass: { default: "" },
    note: { default: "" },
    totp: { default: "" },
  },
  content: "none",
} as const;

export type AccountProps = ReactCustomBlockRenderProps<typeof accountConfig>;
export type AccountBlockT = AccountProps["block"];
export type AccountEditor = AccountProps["editor"];

export type PassStrength = { level: 0 | 1 | 2 | 3; label: string };

export function passStrength(p: string): PassStrength {
  if (!p) return { level: 0, label: "" };
  let score = 0;
  if (p.length >= 8) score += 1;
  if (p.length >= 10) score += 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)) score += 1;
  if (/[^A-Za-z0-9]/.test(p)) score += 1;
  const level: 0 | 1 | 2 | 3 = score >= 3 ? 3 : (score as 0 | 1 | 2 | 3);
  const labels = ["弱", "一般", "中", "强"] as const;
  return { level, label: labels[level] };
}

const GEN_CHARS = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";

export function genPassword(len = 16): string {
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => GEN_CHARS[b % GEN_CHARS.length]).join("");
}
