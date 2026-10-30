import { describe, expect, it } from "vitest";
import { isTableBlock, readAnyTable } from "./anyTable";

/** BlockNote 内置表格的 content 形状 */
const legacyContent = {
  type: "tableContent",
  headerRows: 2,
  headerCols: 1,
  rows: [
    {
      cells: [
        { content: [{ type: "text", text: "科目", styles: {} }] },
        { content: [{ type: "text", text: "分数", styles: {} }] },
      ],
    },
    {
      cells: [
        { content: [{ type: "text", text: "数学", styles: {} }] },
        { content: [{ type: "text", text: "90", styles: {} }] },
      ],
    },
  ],
};

const para = (text: string) => ({
  type: "paragraph",
  props: {},
  content: [{ type: "text", text, styles: {} }],
  children: [],
});

const sparrowData = JSON.stringify({
  headerRows: 1,
  headerCols: 0,
  rows: [
    [{ blocks: [para("科目")], colspan: 2, rowspan: 1 }],
    [
      { blocks: [para("数学")], colspan: 1, rowspan: 1 },
      { blocks: [{ type: "image", props: { url: "x.png", caption: "截图" } }], colspan: 1, rowspan: 1 },
    ],
  ],
});

describe("readAnyTable", () => {
  it("读内置 table：行列与表头都保留", () => {
    const t = readAnyTable({ type: "table", content: legacyContent });
    expect(t).not.toBeNull();
    expect(t?.kind).toBe("table");
    expect(t?.rows).toHaveLength(2);
    expect(t?.cols).toBe(2);
    expect(t?.headerRows).toBe(2);
    expect(t?.headerCols).toBe(1);
  });

  it("读内置 table：格子文本能取出来", () => {
    const t = readAnyTable({ type: "table", content: legacyContent });
    expect(t?.rows[0][0].text).toBe("科目");
    expect(t?.rows[1][1].text).toBe("90");
  });

  it("读自研表格：块数组原样保留，文本抽出来", () => {
    const t = readAnyTable({ type: "sparrowTable", props: { data: sparrowData } });
    expect(t?.kind).toBe("sparrowTable");
    expect(t?.cols).toBe(2);
    expect(t?.headerRows).toBe(1);
    expect(t?.rows[0][0].text).toBe("科目");
    expect(t?.rows[0][0].colspan).toBe(2);
    // 格内图片：文本取 caption
    expect(t?.rows[1][1].text).toBe("截图");
  });

  it("坏数据都返回 null", () => {
    expect(readAnyTable({ type: "table", content: null })).toBeNull();
    expect(readAnyTable({ type: "sparrowTable", props: { data: "{坏" } })).toBeNull();
    expect(readAnyTable({ type: "sparrowTable", props: {} })).toBeNull();
  });

  it("不是表格的块返回 null", () => {
    expect(readAnyTable({ type: "paragraph", content: [] })).toBeNull();
  });

  it("isTableBlock 认得两种表格", () => {
    expect(isTableBlock("table")).toBe(true);
    expect(isTableBlock("sparrowTable")).toBe(true);
    expect(isTableBlock("paragraph")).toBe(false);
    expect(isTableBlock(undefined)).toBe(false);
  });
});
