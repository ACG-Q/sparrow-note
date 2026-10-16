export type EditContainer = "inline" | "side" | "modal";

export const MOBILE_MAX_WIDTH = 768;

export const EDIT_CONTAINER_BY_TYPE: Record<string, EditContainer> = {
  mood: "inline",
  checklist: "inline",
  contact: "side",
  anniversary: "side",
  location: "side",
  account: "side",
  bookmark: "side",
  bankcard: "side",
  drawing: "modal",
  voice: "modal",
};

export function editContainerOf(type: string): EditContainer {
  const container = EDIT_CONTAINER_BY_TYPE[type];
  if (!container) {
    throw new Error(`未知自定义块类型: ${type}`);
  }
  return container;
}
