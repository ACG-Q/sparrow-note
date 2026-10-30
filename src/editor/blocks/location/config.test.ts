import { describe, expect, it } from "vitest";
import { amapLink } from "./config";
import { mapView, wgs84ToGcj02 } from "./geo";
import { getMapProvider, MAP_PROVIDERS } from "../../../lib/mapProviders";

describe("amapLink", () => {
  it("无坐标走关键词搜索", () => {
    expect(amapLink("故宫", "北京")).toBe(
      `https://uri.amap.com/search?keyword=${encodeURIComponent("故宫 北京")}`,
    );
  });

  it("有坐标走 marker 定位：存 WGS-84，跳转前转成 GCJ-02", () => {
    const gcj = wgs84ToGcj02({ lat: 39.9163, lon: 116.3972 });
    const url = amapLink("故宫", "北京", "39.9163, 116.3972");
    expect(url).toBe(
      `https://uri.amap.com/marker?position=${gcj.lon.toFixed(6)},${gcj.lat.toFixed(6)}&name=%E6%95%85%E5%AE%AB`,
    );
    // 天安门一带的偏移量级：几百米，不是几度
    expect(Math.abs(gcj.lat - 39.9163)).toBeLessThan(0.01);
    expect(Math.abs(gcj.lon - 116.3972)).toBeLessThan(0.01);
  });

  it("境外坐标不做偏移", () => {
    expect(wgs84ToGcj02({ lat: 48.8584, lon: 2.2945 })).toEqual({ lat: 48.8584, lon: 2.2945 });
  });

  it("非法坐标回退搜索", () => {
    expect(amapLink("故宫", "北京", "bad")).toContain("/search?keyword=");
  });
});

describe("地图瓦片源", () => {
  it("未知 id 回落到第一个源", () => {
    expect(getMapProvider("nope").id).toBe(MAP_PROVIDERS[0].id);
    expect(getMapProvider(undefined).id).toBe("amap");
  });

  it("mapView 给出 4 块瓦片和署名", () => {
    const v = mapView({ lat: 30.2479, lon: 120.1551 }, "amap");
    expect(v.tiles).toHaveLength(4);
    expect(v.attribution).toBe("© 高德地图");
    expect(v.tiles[0]).toContain("autonavi.com");
    // 点在 512 画布内，靠负边距推到正中
    expect(v.px).toBeGreaterThan(0);
    expect(v.px).toBeLessThan(512);
  });

  it("换了坐标系声明，同一坐标算出的瓦片不同", () => {
    const gcj = mapView({ lat: 30.2479, lon: 120.1551 }, "amap").tiles[0];
    const wgs = mapView({ lat: 48.8584, lon: 2.2945 }, "amap").tiles[0];
    expect(gcj).not.toBe(wgs);
  });
});
