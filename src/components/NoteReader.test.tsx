// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "../db/notes";
import { NoteReader } from "./NoteReader";

// 阅读态会读个人化设置；这里用默认值，避免依赖 localStorage 的时序
vi.mock("../lib/settings", () => {
  const defaults = {
    showCardNumber: false,
    codeCollapseLines: 40,
    summaryKinds: [],
    defaultNoteMode: "read",
  };
  return {
    getSettings: () => defaults,
    useSettings: () => defaults,
    initSettings: () => {},
    setSettings: () => {},
    subscribeSettings: () => () => {},
  };
});

const para = (text: string) => ({
  id: `p-${text}`,
  type: "paragraph",
  props: {},
  content: [{ type: "text", text, styles: {} }],
  children: [],
});

const noteOf = (blocks: unknown[], title = "测试笔记"): NoteDoc => ({
  id: "n1",
  title,
  date: "2026-10-30",
  createdAt: 1,
  updatedAt: 1,
  blocks: blocks as never,
});

describe("NoteReader 全块类型渲染", () => {
  it("文本类块：段落 / 标题 / 引用 / 三种列表 / 勾选 / 分隔线", () => {
    const { container } = render(
      <NoteReader
        note={noteOf([
          para("第一段"),
          { id: "h2", type: "heading", props: { level: 2 }, content: [{ type: "text", text: "小标题", styles: {} }], children: [] },
          { id: "q", type: "quote", props: {}, content: [{ type: "text", text: "引用一句", styles: {} }], children: [] },
          { id: "b1", type: "bulletListItem", props: {}, content: [{ type: "text", text: "无序项", styles: {} }], children: [] },
          { id: "b2", type: "numberedListItem", props: { start: 3 }, content: [{ type: "text", text: "有序项", styles: {} }], children: [] },
          {
            id: "b3",
            type: "checkListItem",
            props: { checked: true },
            content: [{ type: "text", text: "已勾选", styles: {} }],
            children: [],
          },
          { id: "d", type: "divider", props: {}, content: undefined, children: [] },
          { id: "t", type: "toggleListItem", props: {}, content: [{ type: "text", text: "可折叠", styles: {} }], children: [] },
        ])}
      />,
    );
    const text = container.textContent || "";
    expect(text).toContain("第一段");
    expect(text).toContain("小标题");
    expect(text).toContain("引用一句");
    expect(text).toContain("无序项");
    expect(text).toContain("有序项");
    expect(text).toContain("已勾选");
    expect(text).toContain("可折叠");
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("代码块与内联样式（加粗/斜体/删除线/代码/链接）", async () => {
    const { container } = render(
      <NoteReader
        note={noteOf([
          {
            id: "c",
            type: "codeBlock",
            props: { language: "ts" },
            content: [{ type: "text", text: "const a = 1;", styles: {} }],
            children: [],
          },
          {
            id: "s",
            type: "paragraph",
            props: {},
            content: [
              { type: "text", text: "加粗", styles: { bold: true } },
              { type: "text", text: "斜体", styles: { italic: true } },
              { type: "text", text: "删除", styles: { strike: true } },
              { type: "text", text: "行内码", styles: { code: true } },
              { type: "link", href: "https://example.com", content: [{ type: "text", text: "链接文字", styles: {} }] },
            ],
            children: [],
          },
        ])}
      />,
    );
    // 代码块走 Shiki 异步高亮，等它把内容填进来
    await waitFor(() => expect(container.textContent).toContain("const a = 1;"), { timeout: 3000 });
    expect(container.querySelector("strong")?.textContent).toBe("加粗");
    expect(container.querySelector("em")?.textContent).toBe("斜体");
    expect(container.querySelector("s")?.textContent).toBe("删除");
    // 代码块里也有 <code>，这里找行内那个
    const codes = [...container.querySelectorAll("code")].map((c) => c.textContent || "");
    expect(codes.some((t) => t.includes("行内码"))).toBe(true);
    expect(container.querySelector('a[href="https://example.com"]')?.textContent).toBe("链接文字");
  });

  it("两种表格都渲染（内置 table 与 sparrowTable）", () => {
    const sparrow = JSON.stringify({
      headerRows: 1,
      headerCols: 0,
      rows: [
        [{ blocks: [para("科目")], colspan: 2, rowspan: 1 }],
        [
          { blocks: [para("数学")], colspan: 1, rowspan: 1 },
          { blocks: [para("90")], colspan: 1, rowspan: 1 },
        ],
      ],
    });
    const { container } = render(
      <NoteReader
        note={noteOf([
          {
            id: "t1",
            type: "table",
            props: {},
            content: {
              type: "tableContent",
              headerRows: 1,
              headerCols: 0,
              rows: [{ cells: [{ content: [{ type: "text", text: "旧表头", styles: {} }] }] }],
            },
            children: [],
          },
          { id: "t2", type: "sparrowTable", props: { data: sparrow }, content: undefined, children: [] },
        ])}
      />,
    );
    expect(container.textContent).toContain("旧表头");
    expect(container.textContent).toContain("科目");
    expect(container.textContent).toContain("90");
    expect(container.querySelectorAll("table").length).toBe(2);
  });

  it("媒体与附件：图片 / 视频 / 音频 / 手绘 / 语音 / 附件", () => {
    const { container } = render(
      <NoteReader
        note={noteOf([
          { id: "i", type: "image", props: { url: "data:image/png;base64,xx", caption: "配图" }, content: undefined, children: [] },
          { id: "v", type: "video", props: { url: "data:video/mp4;base64,xx" }, content: undefined, children: [] },
          { id: "a", type: "audio", props: { url: "data:audio/mp3;base64,xx" }, content: undefined, children: [] },
          { id: "dr", type: "drawing", props: { data: "data:image/png;base64,yy" }, content: undefined, children: [] },
          { id: "vc", type: "voice", props: { url: "data:audio/wav;base64,zz", wave: "[1,2]" }, content: undefined, children: [] },
          { id: "f", type: "file", props: { url: "data:application/pdf;base64,q", name: "合同.pdf" }, content: undefined, children: [] },
        ])}
      />,
    );
    const text = container.textContent || "";
    expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector("video")).not.toBeNull();
    expect(text).toContain("配图");
    expect(text).toContain("合同.pdf");
  });

  it("实体块：心情 / 地点 / 联系人 / 纪念日 / 清单 / 书签 / 账号 / 银行卡", () => {
    const { container } = render(
      <NoteReader
        note={noteOf([
          { id: "m", type: "mood", props: { emoji: "😀" }, content: [{ type: "text", text: "开心", styles: {} }], children: [] },
          { id: "l", type: "location", props: { name: "闻涛路", addr: "杭州 · 滨江" }, content: undefined, children: [] },
          { id: "c", type: "contact", props: { name: "小林", relation: "朋友", phone: "13800000000" }, content: undefined, children: [] },
          { id: "an", type: "anniversary", props: { title: "生日", date: "2026-10-01" }, content: undefined, children: [] },
          {
            id: "ck",
            type: "checklist",
            props: { items: JSON.stringify([{ t: "交周报", d: true }, { t: "体检", d: false }]) },
            content: undefined,
            children: [],
          },
          { id: "bm", type: "bookmark", props: { title: "示例站", url: "https://example.com" }, content: undefined, children: [] },
          { id: "ac", type: "account", props: { site: "某站", user: "me", pass: "p" }, content: undefined, children: [] },
          { id: "bc", type: "bankcard", props: { bank: "招商", no: "6225880137778888" }, content: undefined, children: [] },
        ])}
      />,
    );
    const text = container.textContent || "";
    for (const expectText of ["开心", "闻涛路", "小林", "交周报", "示例站", "招商"]) {
      expect(text).toContain(expectText);
    }
    // 清单进度 1/2
    expect(text).toContain("1/2");
  });

  it("空笔记与坏数据都不炸", () => {
    const empty = render(<NoteReader note={noteOf([])} />);
    expect(empty.container.textContent).toContain("测试笔记");
    empty.unmount();

    const broken = render(<NoteReader note={{ ...noteOf([]), blocks: "不是数组" as never }} />);
    expect(broken.container.textContent).toBeTruthy();
    broken.unmount();

    const weird = render(
      <NoteReader note={noteOf([{ id: "x", type: "不存在的块", props: {}, content: [], children: [] }])} />,
    );
    expect(weird.container.textContent).toBeTruthy();
  });

  it("显示字数与标题（无标题时回退）", () => {
    const { container } = render(<NoteReader note={noteOf([para("四个中文字符")])} />);
    expect(container.textContent).toContain("字");
    const noTitle = render(<NoteReader note={noteOf([], "")} />);
    expect(noTitle.container.textContent).toContain("无标题");
  });
});
