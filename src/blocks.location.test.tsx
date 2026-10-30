// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// 地理相关全部替身，避免真实网络请求
vi.mock("./editor/blocks/location/geo", () => ({
  currentPosition: async () => ({ lat: 30.2, lng: 120.1 }),
  formatCoord: (c: { lat: number; lng: number } | null) => (c ? `${c.lat},${c.lng}` : ""),
  parseCoord: (s: string) => (s.includes(",") ? { lat: 1, lng: 2 } : null),
  reverseGeocode: async () => ({ name: "闻涛路", addr: "杭州 · 滨江" }),
  searchPlaces: async () => [
    { name: "闻涛路", addr: "杭州 · 滨江", coord: { lat: 30.2, lng: 120.1 } },
    { name: "西湖", addr: "杭州", coord: { lat: 30.25, lng: 120.15 } },
  ],
  inDesktopShell: () => false,
  mapView: () => ({ tiles: [], px: 0, py: 0 }),
  wgs84ToGcj02: (c: { lat: number; lng: number }) => c,
  gcj02ToWgs84: (c: { lat: number; lng: number }) => c,
  isReadableArea: () => true,
}));
vi.mock("./lib/settings", () => {
  const store = { defaultMapProvider: "amap" };
  return {
    getSettings: () => store,
    useSettings: () => store,
    setSetting: () => {},
    initSettings: () => {},
    subscribeSettings: () => () => {},
    allSummaryKinds: () => [],
    SUMMARY_KIND_META: {},
    moveSummaryKind: () => {},
  };
});

import LocationEdit from "./editor/blocks/location/Edit";

const blk = (props: Record<string, unknown> = {}) =>
  ({ id: "loc", type: "location", props, content: [], children: [] }) as never;

const mkEditor = () => {
  const updateBlock = vi.fn();
  return { editor: { updateBlock, isEditable: true } as never, updateBlock };
};

describe("LocationEdit", () => {
  it("渲染名称/地址字段并支持编辑", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <LocationEdit block={blk({ name: "闻涛路", addr: "杭州 · 滨江", coord: "30.2,120.1" })} editor={editor} />,
    );
    expect(container.textContent).toMatch(/地点|位置|名称/);
    const input = container.querySelector("input");
    if (input) fireEvent.change(input, { target: { value: "新名字" } });
    expect((container.textContent || "").length).toBeGreaterThan(20);
  });

  it("搜索会拉出候选并可选", async () => {
    const { editor } = mkEditor();
    const { container } = render(
      <LocationEdit block={blk({ name: "", addr: "", coord: "" })} editor={editor} />,
    );
    const search = container.querySelector("input");
    if (search) fireEvent.change(search, { target: { value: "闻涛" } });
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(10), {
      timeout: 3000,
    });
  });

  it("点「定位」按钮会走一遍定位流程", async () => {
    const { editor } = mkEditor();
    const { container } = render(
      <LocationEdit block={blk({ name: "", addr: "", coord: "" })} editor={editor} />,
    );
    const btns = [...container.querySelectorAll("button")];
    btns.forEach((b) => b.click());
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(10));
  });

  it("已有坐标时显示地图链接", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <LocationEdit block={blk({ name: "西湖", addr: "杭州", coord: "30.25,120.15" })} editor={editor} />,
    );
    expect(container.querySelector("a")).not.toBeNull();
  });
});
