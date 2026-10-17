import { describe, expect, it } from "vitest";
import { groupNo, maskNo } from "./config";

describe("groupNo", () => {
  it("按 4 位分组", () => {
    expect(groupNo("6222021234567890")).toBe("6222 0212 3456 7890");
    expect(groupNo("6222 0212")).toBe("6222 0212");
    expect(groupNo("622")).toBe("622");
    expect(groupNo("")).toBe("");
    expect(groupNo("62a2-02!12")).toBe("6220 212");
  });
});

describe("maskNo（回归）", () => {
  it("超过 4 位掩码前段保留后 4 位", () => {
    expect(maskNo("6222021234567890")).toBe("•••• •••• •••• 7890");
    expect(maskNo("7890")).toBe("7890");
  });
});
