import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const voiceConfig = {
  type: "voice",
  propSchema: {
    ...defaultProps,
    url: { default: "" },
  },
  content: "none",
} as const;

export type VoiceProps = ReactCustomBlockRenderProps<typeof voiceConfig>;
export type VoiceBlockT = VoiceProps["block"];
export type VoiceEditor = VoiceProps["editor"];
