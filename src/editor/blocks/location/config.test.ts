import { describe, expect, it } from "vitest";
import { amapLink } from "./config";

describe("amapLink", () => {
  it("无坐标走关键词搜索", () => {
    expect(amapLink("故宫", "北京")).toBe(
      `https://uri.amap.com/search?keyword=${encodeURIComponent("故宫 北京")}`,
    );
  });

  it("有坐标走 marker 定位（纬度,经度 → position=经度,纬度）", () => {
    expect(amapLink("故宫", "北京", "39.9163, 116.3972")).toBe(
      "https://uri.amap.com/marker?position=116.3972,39.9163&name=%E6%95%85%E5%AE%AB",
    );
  });

  it("非法坐标回退搜索", () => {
    expect(amapLink("故宫", "北京", "bad")).toContain("/search?keyword=");
  });
});
