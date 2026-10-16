import { describe, expect, it } from "vitest";
import { EDIT_CONTAINER_BY_TYPE, MOBILE_MAX_WIDTH, editContainerOf } from "./editMode";

const ALL_TYPES = [
  "account",
  "anniversary",
  "bankcard",
  "bookmark",
  "checklist",
  "contact",
  "drawing",
  "location",
  "mood",
  "voice",
];

describe("editMode 编辑容器映射", () => {
  it("覆盖全部 10 个自定义块类型", () => {
    expect(Object.keys(EDIT_CONTAINER_BY_TYPE).sort()).toEqual([...ALL_TYPES].sort());
  });

  it("六个多字段块走 side 侧边栏", () => {
    for (const t of ["contact", "anniversary", "location", "account", "bookmark", "bankcard"]) {
      expect(editContainerOf(t)).toBe("side");
    }
  });

  it("心情与清单走 inline 内联", () => {
    expect(editContainerOf("mood")).toBe("inline");
    expect(editContainerOf("checklist")).toBe("inline");
  });

  it("绘图与语音走 modal 弹窗", () => {
    expect(editContainerOf("drawing")).toBe("modal");
    expect(editContainerOf("voice")).toBe("modal");
  });

  it("未知类型抛出明确错误", () => {
    expect(() => editContainerOf("unknown")).toThrow("未知自定义块类型: unknown");
  });

  it("移动端断点为 768px", () => {
    expect(MOBILE_MAX_WIDTH).toBe(768);
  });
});
