// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 回归测试：安卓 WebView 里 `window.confirm` 弹的是系统 AlertDialog，
 * 按钮固定英文 OK/CANCEL。危险操作改走 plugin-dialog 的 confirm()，
 * 标题和按钮文案才能和界面一致；浏览器分支必须保持 window.confirm。
 */

const confirmMock = vi.fn(async (_message: string, _opts?: unknown) => true);
vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: (message: string, opts?: unknown) => confirmMock(message, opts),
}));

import { confirmAction } from "./confirm";

function pretendAndroidTauri(): void {
  Object.assign(window, { __TAURI_INTERNALS__: {} });
  window.history.replaceState(null, "", "/?platform=android");
}

function pretendBrowser(): void {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  window.history.replaceState(null, "", "/");
}

beforeEach(() => {
  confirmMock.mockClear();
  confirmMock.mockResolvedValue(true);
});

afterEach(() => {
  pretendBrowser();
});

describe("confirmAction", () => {
  // happy-dom 默认没有 window.confirm，这里显式装一个替身（真实浏览器里它是内置的）
  function stubWindowConfirm(answer: boolean) {
    const fn = vi.fn(() => answer);
    vi.stubGlobal("confirm", fn);
    return fn;
  }

  it("浏览器里仍用 window.confirm", async () => {
    pretendBrowser();
    const native = stubWindowConfirm(false);
    expect(await confirmAction("确定删除？")).toBe(false);
    expect(native).toHaveBeenCalledTimes(1);
    expect(confirmMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("安卓 Tauri 里走插件 confirm，按钮文案是中文", async () => {
    pretendAndroidTauri();
    const native = stubWindowConfirm(true);
    const ok = await confirmAction("确定清空全部笔记？", {
      title: "清空全部数据",
      okLabel: "清空",
      cancelLabel: "取消",
    });
    expect(ok).toBe(true);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock.mock.calls[0][0]).toBe("确定清空全部笔记？");
    expect(confirmMock.mock.calls[0][1]).toMatchObject({
      title: "清空全部数据",
      okLabel: "清空",
      cancelLabel: "取消",
    });
    // 不能落到原生 window.confirm（那边按钮是英文的 OK/CANCEL）
    expect(native).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("移动端用户点取消时返回 false", async () => {
    pretendAndroidTauri();
    confirmMock.mockResolvedValue(false);
    expect(await confirmAction("确定？")).toBe(false);
  });

  it("不传文案时给中文默认值", async () => {
    pretendAndroidTauri();
    await confirmAction("确定？");
    expect(confirmMock.mock.calls[0][1]).toMatchObject({ okLabel: "确定", cancelLabel: "取消" });
  });
});
