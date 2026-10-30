import { describe, expect, it } from "vitest";
import {
  inlineToMarkdown,
  markdownFileName,
  noteToMarkdown,
  noteToMarkdownWithAssets,
  parseDataUrl,
  type ShareBlock,
} from "./share";

const text = (t: string, styles: Record<string, boolean> = {}) => ({ type: "text", text: t, styles });
const p = (content: unknown[], props: Record<string, unknown> = {}): ShareBlock => ({
  id: Math.random().toString(36).slice(2),
  type: "paragraph",
  props,
  content,
  children: [],
});

describe("行内样式", () => {
  it("加粗/斜体/删除线/代码", () => {
    expect(inlineToMarkdown([text("粗", { bold: true })])).toBe("**粗**");
    expect(inlineToMarkdown([text("斜", { italic: true })])).toBe("*斜*");
    expect(inlineToMarkdown([text("删", { strike: true })])).toBe("~~删~~");
    expect(inlineToMarkdown([text("码", { code: true })])).toBe("`码`");
  });

  it("多种样式叠加时不会错位", () => {
    expect(inlineToMarkdown([text("x", { bold: true, code: true })])).toBe("**`x`**");
  });

  it("链接", () => {
    expect(inlineToMarkdown([{ type: "link", href: "https://a.com", content: [text("点我")] }])).toBe(
      "[点我](https://a.com)",
    );
  });

  it("空值不炸", () => {
    expect(inlineToMarkdown(null)).toBe("");
    expect(inlineToMarkdown([null, undefined, 1])).toBe("");
  });
});

describe("块序列化", () => {
  it("标题按层级", () => {
    const md = noteToMarkdown(
      [{ id: "1", type: "heading", props: { level: 2 }, content: [text("标题")], children: [] }],
      { title: "T" },
    );
    expect(md).toContain("## 标题");
  });

  it("列表与勾选", () => {
    const blocks: ShareBlock[] = [
      { id: "a", type: "bulletListItem", props: {}, content: [text("一")], children: [] },
      { id: "b", type: "numberedListItem", props: {}, content: [text("二")], children: [] },
      { id: "c", type: "checkListItem", props: { checked: true }, content: [text("做完了")], children: [] },
    ];
    const md = noteToMarkdown(blocks, { title: "T" });
    expect(md).toContain("- 一");
    expect(md).toContain("1. 二");
    expect(md).toContain("- [x] 做完了");
  });

  it("子块缩进", () => {
    const blocks: ShareBlock[] = [
      {
        id: "a",
        type: "bulletListItem",
        props: {},
        content: [text("父")],
        children: [{ id: "b", type: "bulletListItem", props: {}, content: [text("子")], children: [] }],
      },
    ];
    expect(noteToMarkdown(blocks, { title: "T" })).toContain("  - 子");
  });

  it("代码块带语言", () => {
    const md = noteToMarkdown(
      [{ id: "c", type: "codeBlock", props: { language: "ts" }, content: [text("const a = 1")], children: [] }],
      { title: "T" },
    );
    expect(md).toContain("```ts\nconst a = 1\n```");
  });

  it("表格输出 GFM 且转义竖线", () => {
    const md = noteToMarkdown(
      [
        {
          id: "t",
          type: "table",
          props: {},
          children: [],
          content: {
            rows: [
              { cells: [{ content: [text("列一")] }, { content: [text("列|二")] }] },
              { cells: [{ content: [text("a")] }, { content: [] }] },
            ],
          },
        },
      ],
      { title: "T" },
    );
    expect(md).toContain("| 列一 | 列\\|二 |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| a |   |");
  });

  it("多行表头纵向合并成一行（GFM 只有单行表头）", () => {
    const md = noteToMarkdown(
      [
        {
          id: "t",
          type: "table",
          props: {},
          children: [],
          content: {
            headerRows: 2,
            rows: [
              { cells: [{ content: [text("季度")] }, { content: [text("收入")] }] },
              { cells: [{ content: [text("2026")] }, { content: [text("万元")] }] },
              { cells: [{ content: [text("Q1")] }, { content: [text("12")] }] },
            ],
          },
        },
      ],
      { title: "T" },
    );
    // 两行表头按列用「 / 」串起来，正文只留第三行
    expect(md).toContain("| 季度 / 2026 | 收入 / 万元 |");
    expect(md).toContain("| Q1 | 12 |");
    // 表头不该把第二行当正文再输出一遍
    expect(md).not.toContain("| 2026 | 万元 |");
  });

  it("表头行数超出实际行数也不炸", () => {
    const md = noteToMarkdown(
      [
        {
          id: "t",
          type: "table",
          props: {},
          children: [],
          content: { headerRows: 9, rows: [{ cells: [{ content: [text("只有一行")] }] }] },
        },
      ],
      { title: "T" },
    );
    expect(md).toContain("| 只有一行 |");
    expect(md).toContain("| --- |");
  });

  it("单文件把附件内联成 base64", () => {
    const md = noteToMarkdown(
      [{ id: "i", type: "image", props: { url: "data:image/png;base64,AAAA", caption: "日落" }, children: [] }],
      { title: "T" },
    );
    expect(md).toContain("![日落](data:image/png;base64,AAAA)");
  });

  it("压缩包形态把附件抽到 assets/ 并写相对路径", () => {
    const bundle = noteToMarkdownWithAssets(
      [
        { id: "i", type: "image", props: { url: "data:image/png;base64,AAAA", caption: "日落" }, children: [] },
        { id: "v", type: "audio", props: { url: "data:audio/mpeg;base64,BBBB", name: "录音 1.mp3" }, children: [] },
      ],
      { title: "T" },
    );
    expect(bundle.markdown).toContain("![日落](assets/1-");
    expect(bundle.markdown).toContain("(assets/2-");
    expect(bundle.markdown.trimEnd().endsWith(".mp3)")).toBe(true);
    expect(bundle.assets).toHaveLength(2);
    expect(bundle.assets[0].path.startsWith("assets/1-")).toBe(true);
    expect(bundle.assets[0].path.endsWith(".png")).toBe(true);
    expect(bundle.assets[1].path.startsWith("assets/2-")).toBe(true);
    expect(bundle.assets[1].path.endsWith(".mp3")).toBe(true);
    expect(bundle.assets[0].bytes.length).toBe(3); // "AAA" 三个字节
  });

  it("图片是外链时保留地址", () => {
    const md = noteToMarkdown(
      [{ id: "i", type: "image", props: { url: "https://a.com/x.png", name: "x.png" }, children: [] }],
      { title: "T" },
    );
    expect(md).toContain("![x.png](https://a.com/x.png)");
  });

  it("自定义块用「标签：值」保留信息", () => {
    const md = noteToMarkdown(
      [{ id: "m", type: "mood", props: { mood: "喜" }, content: [text("心情块说明")], children: [] }],
      { title: "T" },
    );
    expect(md).toContain("> **心情**：心情块说明");
  });

  it("未知块退回纯文本，不丢内容", () => {
    const md = noteToMarkdown([{ id: "x", type: "weird", props: {}, content: [text("还在")], children: [] }], {
      title: "T",
    });
    expect(md).toContain("还在");
  });
});

describe("整篇", () => {
  it("带标题和日期", () => {
    const md = noteToMarkdown([p([text("正文")])], { title: "十月二十五日", date: "2026-10-25" });
    expect(md.startsWith("# 十月二十五日")).toBe(true);
    expect(md).toContain("> 2026-10-25");
    expect(md).toContain("正文");
  });

  it("空笔记也有标题", () => {
    expect(noteToMarkdown([], { title: "" })).toContain("# 无标题");
  });

  it("文件名去掉非法字符", () => {
    expect(markdownFileName('a/b:c*?"<>|')).toBe("a_b_c______.md");
    expect(markdownFileName("")).toBe("无标题.md");
  });
});

describe("data URL 解析", () => {
  it("base64 与纯文本都能解", () => {
    expect(parseDataUrl("data:image/png;base64,AAAA")?.mime).toBe("image/png");
    expect(parseDataUrl("data:image/png;base64,AAAA")?.bytes.length).toBe(3);
    expect(parseDataUrl("data:text/plain,hello")?.bytes.length).toBe(5);
    expect(parseDataUrl("https://a.com/x.png")).toBeNull();
    expect(parseDataUrl("data:image/png;base64,@@@")).toBeNull();
  });
});
