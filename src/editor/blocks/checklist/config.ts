import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

export interface ChecklistItem {
  t: string;
  d: boolean;
}

export function parseItems(raw: string): ChecklistItem[] {
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x): x is ChecklistItem =>
        !!x && typeof x === "object" && typeof x.t === "string" && typeof x.d === "boolean",
    );
  } catch {
    return [];
  }
}

export const checklistConfig = {
  type: "checklist",
  propSchema: {
    ...defaultProps,
    items: { default: "[]" },
  },
  content: "none",
} as const;

export type ChecklistProps = ReactCustomBlockRenderProps<typeof checklistConfig>;
export type ChecklistBlockT = ChecklistProps["block"];
export type ChecklistEditor = ChecklistProps["editor"];
