import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const EMOJIS = ["😀", "😄", "😐", "😢", "😡", "🥰", "😴", "🤯", "😎", "😭", "🤒", "🥳"];

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
