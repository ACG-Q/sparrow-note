/** "none" = 只读块，没有编辑外壳（例如 P0 阶段的自研表格） */
export type EditContainer = "inline" | "side" | "modal" | "none";

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
  sparrowTable: "none",
};

export function editContainerOf(type: string): EditContainer {
  const container = EDIT_CONTAINER_BY_TYPE[type];
  if (!container) {
    throw new Error(`未知自定义块类型: ${type}`);
  }
  return container;
}
