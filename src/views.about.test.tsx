// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// 这两个页面会读版本号 / 检查更新 / 查平台权限，单测里不碰真网络与真 IPC
vi.mock("../lib/appInfo", () => ({
  APP_NAME: "麻雀记",
  APP_ID: "com.sparrow.note",
  appVersion: async () => "0.1.0",
  compareVersions: () => 0,
}));
vi.mock("../lib/updates", () => ({
  getUpdateSettings: () => ({ source: "github", githubRepo: "", autoCheck: true }),
  setUpdateSettings: () => {},
  shouldAutoCheck: () => false,
  checkForUpdate: async () => ({ kind: "none" }),
  normalizeGithubRepo: () => null,
}));
vi.mock("../lib/platform", () => ({
  inTauri: () => false,
  platformLabel: () => "网页版",
  runtimeLabel: () => "浏览器",
  isTauri: () => false,
}));

import { AboutView } from "./AboutView";
import { PermissionsView } from "./PermissionsView";

describe("AboutView", () => {
  it("异步拿到版本号后显示出来", async () => {
    const { container } = render(<AboutView onBack={() => {}} />);
    await waitFor(() => expect(container.textContent).toContain("0.1.0"));
    expect(container.textContent).toContain("麻雀记");
  });

  it("点返回会回调 onBack", () => {
    const onBack = vi.fn();
    const { container } = render(<AboutView onBack={onBack} />);
    const back = container.querySelector("button");
    expect(back).not.toBeNull();
    back?.click();
    expect(onBack).toHaveBeenCalled();
  });

  it("有「检查更新」按钮", async () => {
    const { container } = render(<AboutView onBack={() => {}} />);
    await waitFor(() => expect(container.textContent).toContain("0.1.0"));
    const btn = [...container.querySelectorAll("button")].find((b) => /更新/.test(b.textContent || ""));
    expect(btn).toBeTruthy();
  });
});

describe("PermissionsView", () => {
  it("列出权限说明并能返回", async () => {
    const onBack = vi.fn();
    const { container } = render(<PermissionsView onBack={onBack} />);
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(20));
    expect(container.textContent).toMatch(/权限|通知|定位|相机/);
    const back = container.querySelector("button");
    back?.click();
    expect(onBack).toHaveBeenCalled();
  });
});
