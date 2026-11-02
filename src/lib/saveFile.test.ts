// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 回归测试：Android WebView 下 `<a download>` 无效，
 * 必须走 plugin-dialog 的 save() + plugin-fs 的 writeFile()，并且真实反映结果。
 */

/** 安卓「另存为」返回的是 content:// URI，这里用一串带中文的文件名做样本 */
const MD_CONTENT_URI =
  "content://com.android.externalstorage.documents/document/primary%3ADownload%2F%E7%A7%8B%E6%97%A5%E9%AA%91%E8%A1%8C.md";

const saveMock = vi.fn<(opts?: { defaultPath?: string }) => Promise<string | null>>(
  async () => MD_CONTENT_URI,
);
const writeFileMock = vi.fn<(path: string, data: Uint8Array) => Promise<void>>(async () => {});

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: (opts?: unknown) => saveMock(opts as never) }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  writeFile: (path: string, data: Uint8Array) => writeFileMock(path, data),
}));

import {
  dataUrlToBytes,
  displayNameOf,
  mimeOf,
  saveBlobAs,
  saveBytesAs,
  saveDataUrlAs,
  usesSystemSave,
} from "./saveFile";
import { saveImageAs } from "./download";
import { downloadMarkdownZip } from "./shareExport";

/** 冒充「Tauri 移动端」：__TAURI_INTERNALS__ + Android 平台（走 platform.ts 的调试开关） */
function pretendAndroidTauri(): void {
  Object.assign(window, { __TAURI_INTERNALS__: {} });
  window.history.replaceState(null, "", "/?platform=android");
}

function pretendBrowser(): void {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  window.history.replaceState(null, "", "/");
}

/** <a download> 分支的探针 */
function interceptAnchor() {
  const clicked: string[] = [];
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    clicked.push(this.download);
  };
  return {
    clicked,
    restore: () => {
      HTMLAnchorElement.prototype.click = orig;
    },
  };
}

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

beforeEach(() => {
  saveMock.mockClear();
  writeFileMock.mockClear();
  saveMock.mockImplementation(async () => MD_CONTENT_URI);
});

afterEach(() => {
  pretendBrowser();
});

describe("平台判定", () => {
  it("浏览器里不走系统对话框", () => {
    pretendBrowser();
    expect(usesSystemSave()).toBe(false);
  });

  it("安卓 Tauri 里走系统对话框", () => {
    pretendAndroidTauri();
    expect(usesSystemSave()).toBe(true);
  });

  it("桌面 Tauri（Windows）仍用 <a download>", () => {
    Object.assign(window, { __TAURI_INTERNALS__: {} });
    window.history.replaceState(null, "", "/?platform=windows");
    expect(usesSystemSave()).toBe(false);
  });
});

describe("浏览器分支（保持原样）", () => {
  it("saveBytesAs 走 <a download>，不碰插件", async () => {
    pretendBrowser();
    const spy = interceptAnchor();
    try {
      const outcome = await saveBytesAs(new Uint8Array([1, 2, 3]), "报告.pdf");
      expect(outcome).toEqual({ status: "saved", name: "报告.pdf", via: "browser" });
    } finally {
      spy.restore();
    }
    expect(spy.clicked).toEqual(["报告.pdf"]);
    expect(saveMock).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });
});

describe("Tauri 移动端分支", () => {
  it("save() 拿到落点后 writeFile() 写真实字节，不再点 <a download>", async () => {
    pretendAndroidTauri();
    const spy = interceptAnchor();
    let outcome;
    try {
      outcome = await saveBytesAs(new Uint8Array([9, 8, 7]), "秋日骑行.md", "text/markdown");
    } finally {
      spy.restore();
    }

    // 对话框建议的文件名要对得上，否则用户看到的是「document」这种鬼名字
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0][0]).toMatchObject({ defaultPath: "秋日骑行.md" });
    // 真正写盘：路径来自对话框，内容是原始字节
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock.mock.calls[0][0]).toBe(MD_CONTENT_URI);
    expect(Array.from(writeFileMock.mock.calls[0][1])).toEqual([9, 8, 7]);
    // 关键回归点：不能再点 <a download>（安卓上那是空操作）
    expect(spy.clicked).toHaveLength(0);
    expect(outcome).toEqual({ status: "saved", name: "秋日骑行.md", via: "tauri" });
  });

  it("用户在「另存为」里取消 → 返回 cancelled，不写盘也不报成功", async () => {
    pretendAndroidTauri();
    saveMock.mockImplementation(async () => null);
    const spy = interceptAnchor();
    let outcome;
    try {
      outcome = await saveBytesAs(new Uint8Array([1]), "笔记.md");
    } finally {
      spy.restore();
    }
    expect(outcome).toEqual({ status: "cancelled" });
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(spy.clicked).toHaveLength(0);
  });

  it("写盘失败会抛出，交给界面报失败（不能吞掉）", async () => {
    pretendAndroidTauri();
    writeFileMock.mockImplementationOnce(async () => {
      throw new Error("No space left on device");
    });
    await expect(saveBytesAs(new Uint8Array([1]), "笔记.md")).rejects.toThrow(/No space/);
  });

  it("saveBlobAs 把 Blob 按字节写进去（PDF / zip 走这条）", async () => {
    pretendAndroidTauri();
    const blob = new Blob(["# 标题"], { type: "text/markdown" });
    const outcome = await saveBlobAs(blob, "秋日骑行.md");
    expect(outcome).toEqual({ status: "saved", name: "秋日骑行.md", via: "tauri" });
    const bytes = writeFileMock.mock.calls[0][1];
    expect(new TextDecoder().decode(bytes)).toBe("# 标题");
  });

  it("saveDataUrlAs 把 base64 解成字节（长图走这条）", async () => {
    pretendAndroidTauri();
    await saveDataUrlAs(PNG_DATA_URL, "秋日骑行.png");
    expect(saveMock.mock.calls[0][0]).toMatchObject({ defaultPath: "秋日骑行.png" });
    // PNG 魔数
    expect(Array.from(writeFileMock.mock.calls[0][1].slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("saveImageAs 在安卓上真的落盘，并返回 tauri 结果", async () => {
    pretendAndroidTauri();
    saveMock.mockImplementation(
      async () =>
        "content://com.android.externalstorage.documents/document/primary%3ADownload%2F%E6%89%8B%E7%BB%98.png",
    );
    const outcome = await saveImageAs(PNG_DATA_URL, "手绘");
    expect(outcome).toEqual({ status: "saved", name: "手绘.png", via: "tauri" });
    expect(writeFileMock).toHaveBeenCalledTimes(1);
  });

  it("Markdown + 附件在安卓上写成真的 zip", async () => {
    pretendAndroidTauri();
    saveMock.mockImplementation(
      async () =>
        "content://com.android.externalstorage.documents/document/primary%3ADownload%2F%E7%A7%8B%E6%97%A5.zip",
    );
    const outcome = await downloadMarkdownZip({ markdown: "# 标题", assets: [] }, "秋日");
    expect(outcome.status).toBe("saved");
    const bytes = writeFileMock.mock.calls[0][1];
    expect(bytes.length).toBeGreaterThan(0);
    // zip 的本地文件头 'PK'
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
    expect(saveMock.mock.calls[0][0]).toMatchObject({ defaultPath: "秋日.zip" });
  });
});

describe("路径 / MIME 小工具", () => {
  it("content:// URI 解出给人看的文件名", () => {
    expect(displayNameOf(MD_CONTENT_URI, "兜底.md")).toBe("秋日骑行.md");
    expect(displayNameOf("C:\\Users\\me\\导出\\笔记.pdf", "兜底.pdf")).toBe("笔记.pdf");
    expect(displayNameOf("/storage/emulated/0/Download/图.png", "兜底.png")).toBe("图.png");
  });

  it("解不出扩展名时退回建议名", () => {
    expect(displayNameOf("content://com.android.providers.downloads.documents/document/msf%3A42", "兜底.md")).toBe(
      "兜底.md",
    );
  });

  it("扩展名决定 MIME", () => {
    expect(mimeOf("a.png")).toBe("image/png");
    expect(mimeOf("a.PDF")).toBe("application/pdf");
    expect(mimeOf("a.sparrow")).toBe("application/octet-stream");
    expect(mimeOf("没有扩展名")).toBe("application/octet-stream");
  });

  it("data URL 非 base64 时按文本解码", () => {
    const bytes = dataUrlToBytes("data:text/plain,%E4%B8%AD");
    expect(new TextDecoder().decode(bytes)).toBe("中");
    expect(() => dataUrlToBytes("不是 data url")).toThrow();
  });
});
