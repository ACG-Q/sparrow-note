import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const voiceConfig = {
  type: "voice",
  propSchema: {
    ...defaultProps,
    url: { default: "" },
    /** 静态波形："8,12,40,…"（0–100），录音/导入时算一次存下来 */
    wave: { default: "" },
  },
  content: "none",
} as const;

export type VoiceProps = ReactCustomBlockRenderProps<typeof voiceConfig>;
export type VoiceBlockT = VoiceProps["block"];
export type VoiceEditor = VoiceProps["editor"];
