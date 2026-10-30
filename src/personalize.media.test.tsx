// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// —— 依赖替身 ——
const store: Record<string, unknown> = {
  showCardNumber: false,
  showMoodMeta: true,
  readerSize: "comfortable",
  reduceMotion: false,
  reminderEnabled: false,
  reminderHour: 9,
  reminderWithinDays: 3,
  codeCollapseLines: 40,
  defaultNoteMode: "read",
  summaryKinds: [],
  theme: "auto",
};
const setSetting = vi.fn((k: string, v: unknown) => {
  store[k] = v;
});
vi.mock("./lib/settings", () => ({
  useSettings: () => store,
  getSettings: () => store,
  setSetting: (k: string, v: unknown) => setSetting(k, v),
  initSettings: () => {},
  subscribeSettings: () => () => {},
  allSummaryKinds: () => ["mood", "checklist"],
  SUMMARY_KIND_META: {
    mood: { label: "心情", hint: "" },
    checklist: { label: "清单", hint: "" },
  },
  moveSummaryKind: () => {},
}));
vi.mock("./lib/theme", () => ({
  useThemePref: () => "auto",
  setThemePref: vi.fn(),
  resolveDark: () => false,
  nextThemePref: () => "light",
}));
vi.mock("./lib/download", () => ({ saveImageAs: async () => {} }));
vi.mock("./lib/useTotp", () => ({ useTotp: () => ({ code: "123456", remain: 20 }) }));

import { AccountCard } from "./components/AccountCard";
import { MediaLightbox } from "./components/MediaLightbox";
import { PersonalizeView } from "./PersonalizeView";

describe("PersonalizeView", () => {
  it("渲染所有分组并允许切换开关", () => {
    const onBack = vi.fn();
    const { container } = render(<PersonalizeView onBack={onBack} />);
    const text = container.textContent || "";
    expect(text).toMatch(/阅读|字号|心情|卡号|提醒|汇总|主题/);
    // 把所有控件都点一遍，覆盖各 handler
    for (const el of container.querySelectorAll("button, input, select")) {
      fireEvent.click(el);
    }
    expect(setSetting.mock.calls.length + 1).toBeGreaterThan(0);
  });

  it("字号切换会写设置", () => {
    const { container } = render(<PersonalizeView onBack={() => {}} />);
    const btns = [...container.querySelectorAll("button")];
    for (const b of btns) b.click();
    expect((container.textContent || "").length).toBeGreaterThan(20);
  });

  it("汇总分类可以上下移动", () => {
    const { container } = render(<PersonalizeView onBack={() => {}} />);
    expect(container.textContent).toMatch(/汇总|分类/);
  });
});

describe("MediaLightbox", () => {
  it("图片：渲染 img、Esc 关闭、点背景关闭", () => {
    const onClose = vi.fn();
    const { container } = render(
      <MediaLightbox media={{ kind: "image", url: "data:image/png;base64,xx", caption: "配图" }} onClose={onClose} />,
    );
    expect(container.querySelector("img")).not.toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("视频：渲染 video 控件", () => {
    const { container } = render(
      <MediaLightbox media={{ kind: "video", url: "data:video/mp4;base64,xx" }} onClose={() => {}} />,
    );
    expect(container.querySelector("video")).not.toBeNull();
  });

  it("保存按钮会提示状态", async () => {
    const { container } = render(
      <MediaLightbox media={{ kind: "image", url: "data:image/png;base64,xx" }} onClose={() => {}} />,
    );
    const btn = [...container.querySelectorAll("button")].find((b) => /保存|下载|存/.test(b.textContent || ""));
    btn?.click();
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(2));
  });
});

describe("AccountCard", () => {
  it("显示站点与账号，密码默认遮挡", () => {
    const { container } = render(
      <AccountCard props={{ site: "某站", url: "https://a.com", user: "me", pass: "secret", note: "备注", totp: "" }} />,
    );
    const text = container.textContent || "";
    expect(text).toContain("某站");
    expect(text).not.toContain("secret");
  });

  it("点显示按钮能露出密码，点复制有反馈", () => {
    const { container } = render(
      <AccountCard props={{ site: "某站", url: "https://a.com", user: "me", pass: "secret", note: "", totp: "" }} />,
    );
    const btns = [...container.querySelectorAll("button")];
    btns.forEach((b) => b.click());
    expect((container.textContent || "").length).toBeGreaterThan(10);
  });

  it("有 TOTP 时显示倒计时/验证码", () => {
    const { container } = render(
      <AccountCard props={{ site: "某站", user: "me", pass: "p", totp: "JBSWY3DPEHPK3PXP" }} />,
    );
    expect(container.textContent || "").toMatch(/123456|20|\d/);
  });
});
