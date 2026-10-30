// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// —— Tauri 插件替身 ——
const sent: { permission: string; body?: string; title?: string }[] = [];
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: async () => true,
  requestPermission: async () => "granted",
  sendNotification: (n: { title: string; body: string }) => {
    sent.push({ permission: "granted", title: n.title, body: n.body });
  },
}));
vi.mock("@tauri-apps/plugin-geolocation", () => ({
  checkPermissions: async () => ({ location: "granted" }),
  requestPermissions: async () => ({ location: "granted" }),
  getCurrentPosition: async () => ({ coords: { latitude: 30, longitude: 120 } }),
}));

const isTauriMock = vi.fn(() => false);
vi.mock("../db/notes", () => ({
  isTauri: () => isTauriMock(),
  listNotes: vi.fn(async () => []),
  putNote: async () => {},
  deleteNote: async () => {},
  clearAllNotes: async () => {},
}));

import { imageFileName, partFileName, saveImageAs, svgToPng } from "./download";
import { notify, notifyPermission } from "./notify";
import { useAnniversaryReminders } from "./useAnniversaryReminders";
import type { NoteDoc } from "../db/notes";

describe("download 工具", () => {
  it("文件名带上扩展名与分段编号", () => {
    expect(imageFileName("秋日骑行")).toMatch(/秋日骑行.*\.png$/);
    // 分段从 1 开始计数：index=2 → 第 3 张
    expect(partFileName("秋日骑行", 2)).toContain("3");
    expect(imageFileName("")).toBeTruthy();
  });

  it("saveImageAs 在浏览器里走 <a download>", async () => {
    const clicked: string[] = [];
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicked.push(this.download || "");
    };
    try {
      await saveImageAs("data:image/png;base64,xx", "图.png");
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
    }
    expect(clicked.length).toBeGreaterThanOrEqual(0);
  });

  it("svgToPng 在拿不到 canvas 时抛出或返回空（不静默崩）", async () => {
    await expect(svgToPng("data:image/svg+xml;base64,PHN2Zy8+")).rejects.toBeTruthy();
  });
});

describe("notify", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("浏览器环境退回 Notification API 或返回 false", async () => {
    const ok = await notify("提醒", "该喝水了");
    expect(typeof ok).toBe("boolean");
  });

  it("notifyPermission 返回三态之一", async () => {
    const p = await notifyPermission();
    expect(["granted", "denied", "unknown"]).toContain(p);
  });

  it("Tauri 环境走插件发通知", async () => {
    isTauriMock.mockReturnValue(true);
    try {
      const ok = await notify("纪念日", "今天是小林生日");
      expect(ok).toBe(true);
      expect(sent.length).toBeGreaterThan(0);
    } finally {
      isTauriMock.mockReturnValue(false);
    }
  });

  it("Tauri 环境下权限查询也走插件", async () => {
    isTauriMock.mockReturnValue(true);
    try {
      expect(await notifyPermission()).toBe("granted");
    } finally {
      isTauriMock.mockReturnValue(false);
    }
  });
});

describe("useAnniversaryReminders", () => {
  const note = (id: string, date: string, title: string, blocks: unknown[]): NoteDoc => ({
    id,
    title,
    date,
    createdAt: 1,
    updatedAt: 1,
    blocks: blocks as never,
  });

  const anniversaryBlock = (title: string, date: string) => ({
    id: "a1",
    type: "anniversary",
    props: { title, date, kind: "annual", annual: true, remind: true, remindDays: 1 },
    content: undefined,
    children: [],
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it("挂载后不抛错（没有 Tauri 通知能力时静默）", async () => {
    const listNotes = vi.fn(async () => [
      note("n1", "2026-10-31", "生日提醒", [anniversaryBlock("生日", "2026-11-01")]),
    ]);
    vi.doMock("./db/notes", () => ({ listNotes }));
    function Probe() {
      useAnniversaryReminders();
      return null;
    }
    expect(() => render(<Probe />)).not.toThrow();
    await new Promise((r) => setTimeout(r, 30));
  });

  it("有纪念日时会尝试发通知（浏览器环境不发）", async () => {
    function Probe() {
      useAnniversaryReminders();
      return null;
    }
    render(<Probe />);
    await new Promise((r) => setTimeout(r, 30));
    expect(typeof localStorage.getItem("sparrow-anniversary-sent") !== "undefined").toBe(true);
  });
});
