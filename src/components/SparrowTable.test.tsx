// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SparrowTable } from "./SparrowTable";
import { parseSparrowTable } from "../lib/tableData";

const para = (text: string) => ({
  type: "paragraph",
  props: {},
  content: [{ type: "text", text, styles: {} }],
  children: [],
});
const cell = (text: string, extra: { colspan?: number; rowspan?: number } = {}) => ({
  blocks: [para(text)],
  colspan: extra.colspan ?? 1,
  rowspan: extra.rowspan ?? 1,
});

/** 用真实解析结果驱动渲染，避免手写内部结构 */
function table(rows: unknown, headerRows = 1, headerCols = 0) {
  const parsed = parseSparrowTable({
    data: JSON.stringify({ rows, headerRows, headerCols }),
  });
  if (!parsed) throw new Error("测试数据解析失败");
  return parsed;
}

describe("SparrowTable 渲染", () => {
  it("表头行渲染成 th，数据行渲染成 td", () => {
    const { container } = render(
      <SparrowTable table={table([[cell("科目"), cell("分数")], [cell("数学"), cell("90")]])} />,
    );
    const thead = container.querySelector("thead");
    const tbody = container.querySelector("tbody");
    expect(thead?.querySelectorAll("th")).toHaveLength(2);
    expect(tbody?.querySelectorAll("td")).toHaveLength(2);
    expect(thead?.textContent).toContain("科目");
    expect(tbody?.textContent).toContain("90");
  });

  it("colspan / rowspan 落到属性上", () => {
    const { container } = render(
      <SparrowTable
        table={table([
          [cell("合并表头", { colspan: 2 })],
          [cell("A"), cell("B")],
        ])}
      />,
    );
    const th = container.querySelector("th");
    expect(th?.getAttribute("colspan")).toBe("2");
  });

  it("rowspan 也保留", () => {
    const { container } = render(
      <SparrowTable
        table={table([
          [cell("科目", { rowspan: 2 }), cell("Q1")],
          [cell("Q2")],
        ])}
      />,
    );
    expect(container.querySelector("th")?.getAttribute("rowspan")).toBe("2");
  });

  it("表头列（headerCols）用 scope=row", () => {
    const { container } = render(
      <SparrowTable
        table={table([[cell("名称"), cell("值")], [cell("甲"), cell("1")]], 1, 1)}
      />,
    );
    const firstBodyCell = container.querySelector("tbody tr td");
    expect(firstBodyCell?.getAttribute("scope")).toBe("row");
  });

  it("table 有 aria-label（默认「表格」，可传入）", () => {
    const { container, unmount } = render(<SparrowTable table={table([[cell("a")]])} />);
    expect(container.querySelector("table")?.getAttribute("aria-label")).toBe("表格");
    unmount();

    const r2 = render(<SparrowTable table={table([[cell("a")]])} ariaLabel="阅读统计" />);
    expect(r2.container.querySelector("table")?.getAttribute("aria-label")).toBe("阅读统计");
  });

  it("格内图片渲染成 img 且带 alt", () => {
    const { container } = render(
      <SparrowTable
        table={table([
          [
            {
              blocks: [{ type: "image", props: { url: "data:image/png;base64,xx", caption: "图表" } }],
              colspan: 1,
              rowspan: 1,
            },
          ],
        ])}
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("alt")).toBe("图表");
    expect(img?.getAttribute("src")).toBe("data:image/png;base64,xx");
  });

  it("格内多个块都渲染出来（段落 + 代码）", () => {
    const { container } = render(
      <SparrowTable
        table={table([
          [
            {
              blocks: [para("说明"), { type: "codeBlock", props: {}, content: [{ type: "text", text: "npm i", styles: {} }] }],
              colspan: 1,
              rowspan: 1,
            },
          ],
        ])}
      />,
    );
    expect(container.textContent).toContain("说明");
    expect(container.querySelector("pre")?.textContent).toBe("npm i");
  });

  it("链接显示链接文字而不是 URL", () => {
    const { container } = render(
      <SparrowTable
        table={table([
          [
            {
              blocks: [
                {
                  type: "paragraph",
                  props: {},
                  content: [
                    { type: "link", href: "https://example.com", content: [{ type: "text", text: "点这里", styles: {} }] },
                  ],
                  children: [],
                },
              ],
              colspan: 1,
              rowspan: 1,
            },
          ],
        ])}
      />,
    );
    const a = container.querySelector("a");
    expect(a?.textContent).toBe("点这里");
    expect(a?.getAttribute("href")).toBe("https://example.com");
  });

  it("加粗 / 行内代码样式保留", () => {
    const { container } = render(
      <SparrowTable
        table={table([
          [
            {
              blocks: [
                {
                  type: "paragraph",
                  props: {},
                  content: [
                    { type: "text", text: "重点", styles: { bold: true } },
                    { type: "text", text: "code", styles: { code: true } },
                  ],
                  children: [],
                },
              ],
              colspan: 1,
              rowspan: 1,
            },
          ],
        ])}
      />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("重点");
    expect(container.querySelector("code")?.textContent).toBe("code");
  });
});
