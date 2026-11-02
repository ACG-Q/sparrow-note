// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionId, PermState } from "./lib/permissions";
import type { Platform } from "./lib/platform";

/**
 * 权限页回归：按钮必须真的走到申请逻辑，结果要就地显示。
 * 背景：Android 上清单没声明 RECORD_AUDIO/CAMERA 时，点「申请权限」系统连弹窗都不给，
 * 页面却只把状态改成「已拒绝」——用户看不出是「不给」还是「坏了」。
 */

const probePermission = vi.fn(
  async (id: PermissionId, _platform?: Platform): Promise<PermState> =>
    id === "location" ? "granted" : "unknown",
);
const requestPermission = vi.fn(
  async (id: PermissionId, _platform?: Platform): Promise<PermState> =>
    id === "notification" ? "granted" : "denied",
);

vi.mock("./lib/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/permissions")>();
  return {
    ...actual,
    probePermission: (id: PermissionId, platform: Platform) => probePermission(id, platform),
    requestPermission: (id: PermissionId, platform: Platform) =>
      requestPermission(id, platform),
  };
});

import { PermissionsView } from "./PermissionsView";

function setup() {
  // 用 platform.ts 里现成的调试开关冒充安卓
  window.history.replaceState(null, "", "/?platform=android");
  return render(<PermissionsView onBack={() => {}} />);
}

beforeEach(() => {
  probePermission.mockClear();
  requestPermission.mockClear();
  probePermission.mockImplementation(async (id) => (id === "location" ? "granted" : "unknown"));
  requestPermission.mockImplementation(async (id) => (id === "notification" ? "granted" : "denied"));
});

describe("权限页", () => {
  it("进来先探测每一项，顶部给出待申请数量", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/项待授权/));
    // 位置已允许，麦克风 / 相机 / 通知待申请
    expect(container.textContent).toContain("3 项待授权");
    expect(probePermission).toHaveBeenCalledWith("microphone", "android");
    expect(probePermission).toHaveBeenCalledWith("camera", "android");
  });

  it("点「申请权限」会真的发起申请，并把结果就地显示", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/项待授权/));

    const row = [...container.querySelectorAll("div")].find((d) =>
      d.textContent?.includes("麦克风") && d.textContent?.includes("申请权限"),
    );
    const btn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "申请权限" && b.parentElement?.parentElement?.textContent?.includes("麦克风"),
    );
    expect(row).toBeTruthy();
    expect(btn).toBeTruthy();
    fireEvent.click(btn as HTMLElement);

    await waitFor(() => expect(requestPermission).toHaveBeenCalledWith("microphone", "android"));
    await waitFor(() => expect(container.textContent).toContain("系统拒绝了"));
  });

  it("被拒绝后状态变「已拒绝」，给出系统设置路径和「再试一次」", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/项待授权/));
    const btn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "申请权限" && b.parentElement?.parentElement?.textContent?.includes("相机"),
    );
    fireEvent.click(btn as HTMLElement);
    await waitFor(() => expect(container.textContent).toContain("已拒绝"));
    expect(container.textContent).toContain("设置 → 应用 → 麻雀记 → 权限");
    expect([...container.querySelectorAll("button")].some((b) => b.textContent === "再试一次")).toBe(true);
  });

  it("「全部申请」把待申请的都问一遍，被拒绝的不重复问", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/3 项待授权/));

    const all = [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("全部申请"));
    expect(all).toBeTruthy();
    fireEvent.click(all as HTMLElement);

    await waitFor(() => expect(requestPermission).toHaveBeenCalledTimes(3));
    const ids = requestPermission.mock.calls.map((c) => c[0]);
    expect(ids).toEqual(["microphone", "camera", "notification"]);
    // 通知这类被允许的，结果文案要出现
    await waitFor(() => expect(container.textContent).toContain("到期会提醒你"));
  });

  it("「重新检测」把整页重探一遍", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/项待授权/));
    probePermission.mockClear();
    const recheck = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "重新检测",
    );
    expect(recheck).toBeTruthy();
    fireEvent.click(recheck as HTMLElement);
    await waitFor(() => expect(probePermission).toHaveBeenCalledTimes(6));
  });

  it("申请抛错时显示失败原因，不假装成功", async () => {
    requestPermission.mockImplementationOnce(async () => {
      throw new Error("权限服务不可用");
    });
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/项待授权/));
    const btn = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "申请权限" && b.parentElement?.parentElement?.textContent?.includes("麦克风"),
    );
    fireEvent.click(btn as HTMLElement);
    await waitFor(() => expect(container.textContent).toContain("检测出错：权限服务不可用"));
  });
});
