import { describe, expect, it } from "vitest";
import { noteToMarkdown } from "./share";

const p = (text: string) => ({
  type: "paragraph",
  props: {},
  content: [{ type: "text", text, styles: {} }],
  children: [],
});

const cell = (text: string, extra: { colspan?: number; rowspan?: number } = {}) => ({
  blocks: [p(text)],
  colspan: extra.colspan ?? 1,
  rowspan: extra.rowspan ?? 1,
});

const tableBlock = (data: unknown) => ({
  id: "st",
  type: "sparrowTable",
  props: { data: JSON.stringify(data) },
  content: undefined,
  children: [],
});

describe("自研表格（sparrowTable）导出降级", () => {
  it("Markdown 里保留全部单元格文字（不丢字）", () => {
    const md = noteToMarkdown(
      [
        tableBlock({
          headerRows: 1,
          headerCols: 0,
          rows: [
            [cell("科目"), cell("分数")],
            [cell("数学"), cell("90")],
          ],
        }),
      ] as never,
      { title: "测试", date: "2026-10-29" },
    );
    expect(md).toContain("科目");
    expect(md).toContain("分数");
    expect(md).toContain("数学");
    expect(md).toContain("90");
    // GFM 表格结构
    expect(md).toContain("| --- |");
  });

  it("多行表头按列纵向合并成一行", () => {
    const md = noteToMarkdown(
      [
        tableBlock({
          headerRows: 2,
          headerCols: 0,
          rows: [
            [cell("上半年", { colspan: 2 })],
            [cell("Q1"), cell("Q2")],
            [cell("12"), cell("9")],
          ],
        }),
      ] as never,
      { title: "测试", date: "2026-10-29" },
    );
    // 两行表头被「 / 」串起来
    expect(md).toMatch(/上半年.*\/.*Q1|Q1.*\/.*上半年|上半年 \/ /);
    expect(md).toContain("12");
  });

  it("格内是图片时降级成文字，不留空", () => {
    const md = noteToMarkdown(
      [
        tableBlock({
          headerRows: 1,
          headerCols: 0,
          rows: [
            [cell("图")],
            [{ blocks: [{ type: "image", props: { url: "x.png", caption: "截图" } }], colspan: 1, rowspan: 1 }],
          ],
        }),
      ] as never,
      { title: "测试", date: "2026-10-29" },
    );
    expect(md).toContain("截图");
  });

  it("坏数据不炸，也不产生半截表格", () => {
    const md = noteToMarkdown(
      [{ id: "st", type: "sparrowTable", props: { data: "{坏" }, content: undefined, children: [] }] as never,
      { title: "测试", date: "2026-10-29" },
    );
    expect(typeof md).toBe("string");
    expect(md).not.toContain("| --- |");
  });
});
