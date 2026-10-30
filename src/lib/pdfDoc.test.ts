import { describe, expect, it } from "vitest";
import { toAtoms, wrapAtoms, textOfBlocks, type Measure } from "./pdfDoc";

/**
 * PDF 排版里能单独测的部分：把块内联内容切成原子、按宽度折行。
 * 这两步出错的后果是「中文被切碎」或「行宽溢出」，靠肉眼很难发现，
 * 所以用等宽字体模拟 measure，把规则钉住。
 */
const mono: Measure = (text) => text.length * 10; // 每个字符 10pt

describe("toAtoms", () => {
  it("中文按单字拆，拉丁按词拆", () => {
    const atoms = toAtoms([
      { type: "text", text: "普通", styles: {} },
      { type: "text", text: " hello world", styles: {} },
    ]);
    // 中文一个字一个原子，西文一个词一个原子（空格单独成原子）
    expect(atoms.map((a) => a.text)).toEqual(["普", "通", " ", "hello", " ", "world"]);
  });

  it("样式标记跟着原子走", () => {
    const atoms = toAtoms([
      { type: "text", text: "加粗", styles: { bold: true } },
      { type: "text", text: "代码", styles: { code: true } },
    ]);
    expect(atoms.filter((a) => a.bold).map((a) => a.text)).toEqual(["加", "粗"]);
    expect(atoms.filter((a) => a.code).map((a) => a.text)).toEqual(["代", "码"]);
  });

  it("链接节点也拆开，且都带 link 标记", () => {
    const atoms = toAtoms([
      { type: "link", href: "https://example.com", content: [{ type: "text", text: "点这里", styles: {} }] },
    ]);
    expect(atoms.map((a) => a.text)).toEqual(["点", "这", "里"]);
    expect(atoms.every((a) => a.link)).toBe(true);
  });

  it("坏数据不炸", () => {
    expect(toAtoms(undefined)).toEqual([]);
    expect(toAtoms([{ type: "text" }])).toEqual([]);
    expect(toAtoms(null)).toEqual([]);
  });
});

describe("wrapAtoms", () => {
  it("按宽度折行，不丢字", () => {
    const atoms = toAtoms([{ type: "text", text: "一二三四五六七八九十", styles: {} }]);
    const lines = wrapAtoms(atoms, 50, 10, mono);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((l) => l.text).join("")).toBe("一二三四五六七八九十");
  });

  it("正常词组折行时，每行不超过上限", () => {
    const atoms = toAtoms([{ type: "text", text: "aa bb cc dd ee ff", styles: {} }]);
    const lines = wrapAtoms(atoms, 60, 10, mono);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.width).toBeLessThanOrEqual(60 + 0.01);
    }
  });

  it("单个原子就超宽时独占一行，宁可行宽溢出也不截断", () => {
    const atoms = toAtoms([{ type: "text", text: "abcdefghij", styles: {} }]);
    const lines = wrapAtoms(atoms, 40, 10, mono);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("abcdefghij");
  });

  it("超长单词自己占一行，不被截断", () => {
    const atoms = toAtoms([{ type: "text", text: "https://example.com/very/long/path", styles: {} }]);
    const lines = wrapAtoms(atoms, 40, 10, mono);
    expect(lines.length).toBe(1);
    expect(lines[0].text).toBe("https://example.com/very/long/path");
  });

  it("空内容返回空行数组", () => {
    expect(wrapAtoms([], 100, 10, mono)).toEqual([]);
  });
});

describe("textOfBlocks", () => {
  it("按块类型串出纯文本（PDF 抽文本一致性的基础）", () => {
    const text = textOfBlocks([
      { id: "h", type: "heading", props: { level: 1 }, content: [{ type: "text", text: "标题", styles: {} }] },
      { id: "p", type: "paragraph", props: {}, content: [{ type: "text", text: "正文", styles: {} }] },
      {
        id: "t",
        type: "table",
        props: {},
        content: {
          headerRows: 2,
          rows: [
            { cells: [{ content: [{ type: "text", text: "季度", styles: {} }] }] },
            { cells: [{ content: [{ type: "text", text: "2026", styles: {} }] }] },
          ],
        },
      },
    ] as never);
    expect(text).toContain("标题");
    expect(text).toContain("正文");
    // 表格由 drawTable 单独排版，这里只出纯文本块
    expect(text).not.toContain("季度");
  });
});
