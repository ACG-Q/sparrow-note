import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export const WIDTH = 720;
export const HEIGHT = 320;
export const COLORS = ["#191919", "#e03e3e", "#2383e2", "#0f7b6c", "#f59e0b", "#8b5cf6"];

export const drawingConfig = {
  type: "drawing",
  propSchema: {
    ...defaultProps,
    data: { default: "" },
  },
  content: "none",
} as const;

export type DrawingProps = ReactCustomBlockRenderProps<typeof drawingConfig>;
export type DrawingBlockT = DrawingProps["block"];
export type DrawingEditor = DrawingProps["editor"];
