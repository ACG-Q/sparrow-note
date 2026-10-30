// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { entityRenderers, type EntityRenderCtx } from "./entityBlocks";
import type { AnyBlock } from "./types";

const ctx = (over: Partial<EntityRenderCtx> = {}): EntityRenderCtx => ({
  showCard: false,
  onPreviewImage: () => {},
  onPreviewFile: () => {},
  onToggleCard: () => {},
  noteDate: "2026-10-30",
  ...over,
});

const block = (type: string, props: Record<string, unknown>): AnyBlock => ({
  id: "b1",
  type,
  props,
  content: [],
});

const draw = (type: string, props: Record<string, unknown>, c = ctx()) => {
  const node = entityRenderers[type](block(type, props), "k0", c);
  return render(<>{node}</>);
};

describe("checklist 渲染", () => {
  it("显示 已完成/总数 与进度条宽度", () => {
    const items = [
      { t: "交周报", d: true },
      { t: "体检", d: false },
      { t: "保养", d: false },
      { t: "买菜", d: true },
    ];
    const { container } = draw("checklist", { items: JSON.stringify(items) });
    expect(container.textContent).toContain("2/4");
    const bar = container.querySelector("i");
    expect(bar?.getAttribute("style")).toContain("width: 50%");
    expect(container.textContent).toContain("交周报");
  });

  it("已完成项带 done 类，未完成不带", () => {
    const { container } = draw("checklist", {
      items: JSON.stringify([
        { t: "做完的", d: true },
        { t: "没做的", d: false },
      ]),
    });
    const lis = [...container.querySelectorAll("li")];
    expect(lis[0].className).toBeTruthy();
    expect(lis[1].className).toBeFalsy();
  });

  it("坏 JSON 不炸，退化成不渲染", () => {
    expect(draw("checklist", { items: "{坏" }).container.textContent).toBe("");
  });

  it("空清单不渲染", () => {
    expect(draw("checklist", { items: "[]" }).container.textContent).toBe("");
  });
});

describe("bookmark 渲染", () => {
  it("有标题用标题，没有标题用 URL", () => {
    const withTitle = draw("bookmark", { url: "https://a.com", title: "示例站" });
    expect(withTitle.container.textContent).toContain("示例站");
    expect(withTitle.container.querySelector("a")?.getAttribute("href")).toBe("https://a.com");

    const noTitle = draw("bookmark", { url: "https://b.com" });
    expect(noTitle.container.textContent).toContain("https://b.com");
  });

  it("没有 url 不渲染", () => {
    expect(draw("bookmark", {}).container.textContent).toBe("");
  });
});

describe("bankcard 渲染", () => {
  it("默认打码，点查看回调 onToggleCard", () => {
    const onToggleCard = vi.fn();
    const { container } = draw(
      "bankcard",
      { bank: "招商", no: "6225880137778888", holder: "刘" },
      ctx({ onToggleCard }),
    );
    const text = container.textContent ?? "";
    expect(text).toContain("招商");
    expect(text).not.toContain("6225880137778888");
    const btn = [...container.querySelectorAll("button")].find((b) => /查看|隐藏/.test(b.textContent ?? ""));
    expect(btn?.textContent).toBe("查看");
    btn?.click();
    expect(onToggleCard).toHaveBeenCalled();
  });

  it("showCard 时显示完整卡号（每 4 位分组）", () => {
    const { container } = draw(
      "bankcard",
      { bank: "招商", no: "6225880137778888" },
      ctx({ showCard: true }),
    );
    expect(container.textContent).toContain("6225 8801 3777 8888");
  });

  it("银行和卡号都没有时不渲染", () => {
    expect(draw("bankcard", { holder: "刘" }).container.textContent).toBe("");
  });
});

describe("drawing 渲染", () => {
  it("图带 alt，点一下触发大图预览", () => {
    const onPreviewImage = vi.fn();
    const { container } = draw(
      "drawing",
      { data: "data:image/png;base64,xx" },
      ctx({ onPreviewImage }),
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("手绘");
    container.querySelector("button")?.click();
    expect(onPreviewImage).toHaveBeenCalledWith("data:image/png;base64,xx", "手绘");
  });

  it("没有图不渲染", () => {
    expect(draw("drawing", {}).container.textContent).toBe("");
  });
});

describe("file 渲染", () => {
  it("显示文件名、下载链接，点预览回调", () => {
    const onPreviewFile = vi.fn();
    const { container } = draw(
      "file",
      { url: "data:application/pdf;base64,xx", name: "合同.pdf" },
      ctx({ onPreviewFile }),
    );
    expect(container.textContent).toContain("合同.pdf");
    const dl = container.querySelector("a");
    expect(dl?.getAttribute("download")).toBe("合同.pdf");
    expect(dl?.getAttribute("aria-label")).toBe("下载");
    const preview = [...container.querySelectorAll("button")].find((b) => /预览/.test(b.textContent ?? ""));
    preview?.click();
    expect(onPreviewFile).toHaveBeenCalledWith({ name: "合同.pdf", url: "data:application/pdf;base64,xx" });
  });

  it("没有名字时用后缀当描述", () => {
    const { container } = draw("file", { url: "data:x", name: "报告.docx" });
    expect(container.textContent).toContain("DOCX");
  });
});

describe("注册表", () => {
  it("只登记了实体/附件类块", () => {
    expect(Object.keys(entityRenderers).sort()).toEqual(
      ["account", "bankcard", "bookmark", "checklist", "drawing", "file", "voice"].sort(),
    );
  });
});
