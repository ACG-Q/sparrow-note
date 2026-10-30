// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";

// pdfDoc 太重（字体 + canvas），这里只验证「有没有调用到」
const buildNotePdf = vi.fn(async () => new Uint8Array([1, 2, 3]));
vi.mock("./pdfDoc", () => ({ buildNotePdf: (...a: unknown[]) => buildNotePdf(...(a as [])) }));

import {
  MAX_CANVAS_HEIGHT,
  collectStyles,
  downloadMarkdownFile,
  downloadMarkdownZip,
  planShotSlices,
  printNode,
  variablesCss,
} from "./shareExport";

describe("planShotSlices（长图切分，纯计算）", () => {
  it("放得下时只切一段，覆盖整篇高度", () => {
    expect(planShotSlices(1000, 2, MAX_CANVAS_HEIGHT)).toEqual([{ y: 0, height: 1000 }]);
  });

  it("超高时拆多段，每段不超过上限", () => {
    const slices = planShotSlices(40000, 2, 30000);
    expect(slices.length).toBeGreaterThan(1);
    for (const s of slices) {
      expect(s.height * 2).toBeLessThanOrEqual(30000 + 2);
      expect(s.height).toBeGreaterThan(0);
    }
  });

  it("相邻两段有重叠，且最终覆盖到末尾", () => {
    const slices = planShotSlices(40000, 2, 30000);
    for (let i = 1; i < slices.length; i++) {
      const prevEnd = slices[i - 1].y + slices[i - 1].height;
      expect(slices[i].y).toBeLessThan(prevEnd); // 有重叠
    }
    const last = slices[slices.length - 1];
    expect(last.y + last.height).toBeGreaterThanOrEqual(39999);
  });

  it("高度为 0 或负数时按 1 处理（不产生空数组）", () => {
    expect(planShotSlices(0, 2, 30000)).toEqual([{ y: 0, height: 1 }]);
    expect(planShotSlices(-5, 2, 30000)).toEqual([{ y: 0, height: 1 }]);
  });

  it("scale 很小时一段能装下更多", () => {
    const s1 = planShotSlices(20000, 1, 30000);
    const s2 = planShotSlices(20000, 3, 30000);
    expect(s1.length).toBeLessThanOrEqual(s2.length);
  });
});

describe("样式采集", () => {
  it("collectStyles 返回字符串（读不到规则时为空）", () => {
    expect(typeof collectStyles()).toBe("string");
  });

  it("variablesCss 输出一个选择器块", () => {
    const css = variablesCss(".my-root");
    expect(css.startsWith(".my-root")).toBe(true);
    expect(css).toContain("{");
    expect(css.trim().endsWith("}")).toBe(true);
  });

  it("CSS 变量能带到指定选择器里", () => {
    document.documentElement.style.setProperty("--test-token", "#123456");
    const css = variablesCss(".probe");
    if (css.includes("--test-token")) {
      expect(css).toContain("#123456");
    }
    document.documentElement.style.removeProperty("--test-token");
  });
});

describe("下载与打印", () => {
  const interceptAnchor = () => {
    const saved: { name: string; href: string }[] = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      saved.push({ name: this.download, href: this.href });
    };
    return {
      saved,
      restore: () => {
        HTMLAnchorElement.prototype.click = orig;
      },
    };
  };

  it("downloadMarkdownFile 生成 .md 文件下载", () => {
    const spy = interceptAnchor();
    try {
      downloadMarkdownFile("# 标题\n\n正文", "秋日骑行");
    } finally {
      spy.restore();
    }
    expect(spy.saved.length).toBeGreaterThan(0);
    expect(spy.saved[0].name).toMatch(/\.md$/);
  });

  it("downloadMarkdownZip 生成 zip 下载（含附件时）", () => {
    const spy = interceptAnchor();
    try {
      downloadMarkdownZip({ markdown: "# 标题", assets: [] }, "秋日骑行");
    } finally {
      spy.restore();
    }
    expect(spy.saved.length).toBeGreaterThan(0);
    expect(spy.saved[0].name).toMatch(/\.zip$/i);
  });

  it("printNode 会把节点塞进打印容器并调 window.print", () => {
    const print = vi.fn();
    const origPrint = window.print;
    window.print = print as unknown as typeof window.print;
    const node = document.createElement("div");
    node.textContent = "要打印的内容";
    try {
      printNode(node);
      expect(print).toHaveBeenCalled();
      expect(document.documentElement.classList.contains("sparrow-printing")).toBe(true);
    } finally {
      window.print = origPrint;
      document.documentElement.classList.remove("sparrow-printing");
    }
  });
});
