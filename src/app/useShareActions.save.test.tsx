// @vitest-environment happy-dom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "../db/notes";

/**
 * 回归测试：导出提示必须等于真实结果。
 * 之前 Android WebView 里 `<a download>` 是空操作，界面却照样报「已导出」。
 */

type Outcome = { status: "saved"; name: string; via: "tauri" | "browser" } | { status: "cancelled" };

const exportMock = vi.hoisted(() => ({
  md: vi.fn<() => Promise<Outcome>>(),
  zip: vi.fn<() => Promise<Outcome>>(),
  pdf: vi.fn<() => Promise<Outcome>>(),
  png: vi.fn<() => Promise<{ count: number; saves: Outcome[] }>>(),
}));

vi.mock("../lib/share", () => ({
  noteToMarkdown: () => "# md",
  noteToMarkdownWithAssets: () => ({ markdown: "# md", assets: [] }),
}));
vi.mock("../lib/shareExport", () => ({
  downloadMarkdownFile: () => exportMock.md(),
  downloadMarkdownZip: () => exportMock.zip(),
  exportNotePdf: () => exportMock.pdf(),
  exportNodePng: () => exportMock.png(),
  printNode: () => {},
}));

import { useShareActions } from "./useShareActions";

const note: NoteDoc = {
  id: "n1",
  title: "秋日骑行",
  date: "2026-11-02",
  createdAt: 1,
  updatedAt: 1,
  blocks: [],
};

function probe() {
  const box = { current: null as unknown as ReturnType<typeof useShareActions> };
  function Probe() {
    box.current = useShareActions(note);
    return null;
  }
  render(<Probe />);
  return box;
}

/** 等 hook 里的 promise 链跑完 */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  exportMock.md.mockResolvedValue({ status: "saved", name: "秋日骑行.md", via: "tauri" });
  exportMock.zip.mockResolvedValue({ status: "saved", name: "秋日骑行.zip", via: "tauri" });
  exportMock.pdf.mockResolvedValue({ status: "saved", name: "秋日骑行.pdf", via: "tauri" });
  exportMock.png.mockResolvedValue({
    count: 1,
    saves: [{ status: "saved", name: "秋日骑行.png", via: "tauri" }],
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("导出提示跟随真实结果", () => {
  it("移动端真的写盘了才说「已保存」并带上文件名", async () => {
    const share = probe();
    share.current.shareMarkdown();
    await settle();
    expect(share.current.shareHint).toBe("已保存 秋日骑行.md");
  });

  it("浏览器分支说「已开始下载」（下载无法进一步确认）", async () => {
    exportMock.zip.mockResolvedValue({ status: "saved", name: "秋日骑行.zip", via: "browser" });
    const share = probe();
    share.current.shareMarkdownZip();
    await settle();
    expect(share.current.shareHint).toBe("已开始下载 秋日骑行.zip");
  });

  it("用户在「另存为」里取消时报取消，不报成功", async () => {
    exportMock.pdf.mockResolvedValue({ status: "cancelled" });
    const share = probe();
    share.current.sharePdf();
    await settle();
    expect(share.current.shareHint).toBe("已取消保存");
  });

  it("生成 / 写盘失败时报失败原因", async () => {
    exportMock.pdf.mockRejectedValue(new Error("字体加载失败"));
    const share = probe();
    share.current.sharePdf();
    await settle();
    expect(share.current.shareHint).toBe("导出 PDF 失败：字体加载失败");
  });

  it("长图多张：只数真的存下的张数", async () => {
    document.body.innerHTML = '<div data-share-root="1"></div>';
    exportMock.png.mockResolvedValue({
      count: 3,
      saves: [
        { status: "saved", name: "a.png", via: "tauri" },
        { status: "saved", name: "b.png", via: "tauri" },
        { status: "cancelled" },
      ],
    });
    const share = probe();
    share.current.sharePng();
    await settle();
    expect(share.current.shareHint).toBe("已保存 2 张图，其余已取消");
  });

  it("长图第一张就取消 → 已取消保存", async () => {
    document.body.innerHTML = '<div data-share-root="1"></div>';
    exportMock.png.mockResolvedValue({ count: 2, saves: [{ status: "cancelled" }] });
    const share = probe();
    share.current.sharePng();
    await settle();
    expect(share.current.shareHint).toBe("已取消保存");
  });

  it("长图渲染失败时提示失败原因", async () => {
    document.body.innerHTML = '<div data-share-root="1"></div>';
    exportMock.png.mockRejectedValue(new Error("内容渲染失败"));
    const share = probe();
    share.current.sharePng();
    await settle();
    expect(share.current.shareHint).toBe("长图导出失败：内容渲染失败");
  });
});
