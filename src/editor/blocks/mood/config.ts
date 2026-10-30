import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";
import { MOOD_EMOJIS } from "../../../lib/mood";

/** 选择表与 mood.ts 的映射共用一份，避免两处列表漂移 */
export const EMOJIS = MOOD_EMOJIS;

export const moodConfig = {
  type: "mood",
  propSchema: {
    ...defaultProps,
    emoji: { default: "🙂" },
  },
  content: "inline",
} as const;

export type MoodProps = ReactCustomBlockRenderProps<typeof moodConfig>;
export type MoodBlockT = MoodProps["block"];
export type MoodEditor = MoodProps["editor"];
