import { describe, expect, it } from "vitest";
import { columnCount, parseSparrowTable, serializeSparrowTable } from "./tableData";

const cell = (text: string, extra: { colspan?: number; rowspan?: number } = {}) => ({
  blocks: [{ type: "paragraph", content: [{ type: "text", text, styles: {} }] }],
  colspan: extra.colspan ?? 1,
  rowspan: extra.rowspan ?? 1,
});

const tableOf = (rows: unknown, headerRows = 1) =>
  JSON.stringify({ headerRows, headerCols: 1, rows });

describe("parseSparrowTable", () => {
  it("解析正常表格", () => {
    const t = parseSparrowTable({
      data: tableOf([
        [cell("季度"), cell("销量")],
        [cell("Q1"), cell("12")],
      ]),
    });
    expect(t).not.toBeNull();
    expect(t?.headerRows).toBe(1);
    expect(t?.rows).toHaveLength(2);
    expect(t?.rows[0][0].blocks).toHaveLength(1);
  });

  it("保留 colspan / rowspan", () => {
    const t = parseSparrowTable({
      data: tableOf([
        [cell("合并表头", { colspan: 2 })],
        [cell("A"), cell("B")],
      ]),
    });
    expect(t?.rows[0][0].colspan).toBe(2);
  });

  it("坏数据返回 null，不抛异常", () => {
    expect(parseSparrowTable({ data: undefined })).toBeNull();
    expect(parseSparrowTable({ data: "{不是 json" })).toBeNull();
    expect(parseSparrowTable({ data: JSON.stringify({ rows: [] }) })).toBeNull();
    expect(parseSparrowTable({ data: JSON.stringify({ rows: [[{ colspan: 1 }]] }) })).toBeNull();
    expect(parseSparrowTable({ data: JSON.stringify({ rows: ["not-array"] }) })).toBeNull();
  });

  it("表头行数不会超过实际行数", () => {
    const t = parseSparrowTable({ data: tableOf([[cell("a")]], 99) });
    expect(t?.headerRows).toBe(1);
  });

  it("格内可以放非段落块（图片等）", () => {
    const t = parseSparrowTable({
      data: tableOf([
        [
          {
            blocks: [{ type: "image", props: { url: "data:image/png;base64,xx" } }],
            colspan: 1,
            rowspan: 1,
          },
        ],
      ]),
    });
    expect(t?.rows[0][0].blocks[0]).toMatchObject({ type: "image" });
  });
});

describe("columnCount", () => {
  it("按 colspan 求和取最大", () => {
    const t = parseSparrowTable({
      data: tableOf([
        [cell("合并", { colspan: 3 })],
        [cell("a"), cell("b"), cell("c")],
      ]),
    });
    expect(t && columnCount(t)).toBe(3);
  });
});

describe("serializeSparrowTable", () => {
  it("序列化后还能解析回来", () => {
    const t = parseSparrowTable({
      data: tableOf([
        [cell("甲"), cell("乙")],
        [cell("1"), cell("2")],
      ]),
    });
    if (!t) throw new Error("解析失败");
    const again = parseSparrowTable({ data: serializeSparrowTable(t) });
    expect(again?.rows).toHaveLength(2);
    expect(columnCount(again!)).toBe(2);
  });
});
