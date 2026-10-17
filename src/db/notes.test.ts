import { describe, expect, it, vi } from "vitest";
import { idbBackend } from "./idb";
import { isTauri, resolveBackend } from "./notes";
import { sqliteBackend } from "./sqlite";

describe("存储双后端分发", () => {
  it("Tauri 环境路由到 sqliteBackend", () => {
    expect(resolveBackend(true)).toBe(sqliteBackend);
  });

  it("浏览器环境路由到 idbBackend", () => {
    expect(resolveBackend(false)).toBe(idbBackend);
  });

  it("isTauri 无 window 标记时返回 false", () => {
    expect(isTauri()).toBe(false);
  });

  it("isTauri 检测 __TAURI_INTERNALS__ 标记", () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    try {
      expect(isTauri()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
