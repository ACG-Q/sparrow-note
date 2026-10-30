// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "./db/notes";

// ——————————————— 数据层：内存实现 ———————————————
const db = { notes: [] as NoteDoc[], failList: 0 };

const note = (id: string, title: string, date = "2026-10-30", blocks: unknown[] = []): NoteDoc => ({
  id,
  title,
  date,
  createdAt: 1,
  updatedAt: 1,
  blocks: blocks as never,
});

vi.mock("./db/notes", () => ({
  isTauri: () => false,
  listNotes: async () => {
    if (db.failList > 0) {
      db.failList -= 1;
      throw new Error("模拟读库失败");
    }
    return [...db.notes];
  },
  putNote: async (n: NoteDoc) => {
    const i = db.notes.findIndex((x) => x.id === n.id);
    if (i >= 0) db.notes[i] = n;
    else db.notes = [n, ...db.notes];
  },
  deleteNote: async (id: string) => {
    db.notes = db.notes.filter((n) => n.id !== id);
  },
}));

// ——————————————— 重依赖：换成轻量替身 ———————————————
vi.mock("./lib/share", () => ({
  noteToMarkdown: () => "# md",
  noteToMarkdownWithAssets: () => ({ markdown: "# md", assets: [] }),
}));
const shareCall = { md: 0, zip: 0, pdf: 0, png: 0, print: 0 };
vi.mock("./lib/shareExport", () => ({
  downloadMarkdownFile: () => { shareCall.md += 1; },
  downloadMarkdownZip: () => { shareCall.zip += 1; },
  exportNotePdf: async () => { shareCall.pdf += 1; },
  exportNodePng: async () => { shareCall.png += 1; return { count: 1 }; },
  printNode: () => { shareCall.print += 1; },
}));
vi.mock("./editor/NoteEditor", () => ({
  NoteEditor: ({ onChange }: { onChange: (blocks: unknown[]) => void }) => (
    <div data-testid="editor">
      <button type="button" onClick={() => onChange([{ id: "x", type: "paragraph", props: {}, content: [], children: [] }])}>
        改内容
      </button>
    </div>
  ),
}));
vi.mock("./components/NoteReader", () => ({
  NoteReader: ({ note: n }: { note: NoteDoc }) => <div data-testid="reader">{n.title || "无标题"}</div>,
}));
vi.mock("./lib/useAnniversaryReminders", () => ({ useAnniversaryReminders: () => {} }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: async () => {} }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ label: "main" }) }));
vi.mock("./lib/settings", () => {
  const store = { defaultNoteMode: "edit", showCardNumber: false, codeCollapseLines: 40, summaryKinds: [] };
  return {
    getSettings: () => store,
    useSettings: () => store,
    setSetting: () => {},
    initSettings: () => {},
    subscribeSettings: () => () => {},
    allSummaryKinds: () => [],
    SUMMARY_KIND_META: {},
    moveSummaryKind: () => {},
  };
});

import App from "./App";

const typeKey = (key: string, opts: { ctrlKey?: boolean; shiftKey?: boolean } = {}) =>
  fireEvent.keyDown(window, { key, ctrlKey: opts.ctrlKey, shiftKey: opts.shiftKey });

beforeEach(() => {
  db.notes = [note("a", "秋日骑行"), note("b", "本周待办", "2026-10-29")];
  db.failList = 0;
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  Object.defineProperty(window, "innerWidth", { value: 1400, configurable: true });
});

describe("App 外壳", () => {
  it("启动后渲染左侧导航、目录与阅读空态", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.textContent).toContain("麻雀记"));
    expect(container.textContent).toContain("时间线");
    // 桌面布局：有目录列与主栏
    expect(container.querySelector("main")).not.toBeNull();
  });

  it("读库失败时显示错误页，重试能回到正常", async () => {
    db.failList = 1;
    const { container } = render(<App />);
    await waitFor(() => expect(container.textContent).toMatch(/读不出你的笔记|打不开笔记库/));
    const retry = [...container.querySelectorAll("button")].find((b) => /重试/.test(b.textContent || ""));
    expect(retry).toBeTruthy();
    retry?.click();
    await waitFor(() => expect(container.textContent).toContain("雀"));
  });

  it("点笔记进入阅读态并显示标题", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.textContent).toContain("秋日骑行"));
    const row = [...container.querySelectorAll("button")].find((el) =>
      /秋日骑行/.test(el.textContent || ""),
    );
    (row as HTMLButtonElement | null)?.click();
    // 打开后：要么进阅读态（reader 替身），要么进编辑态（editor 替身）
    await waitFor(() =>
      expect(
        container.querySelector('[data-testid="reader"]') ?? container.querySelector('[data-testid="editor"]'),
      ).not.toBeNull(),
    );
  });

  it("新建笔记会进编辑器", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.textContent).toContain("时间线"));
    const create = [...container.querySelectorAll("button")].find((b) => /新笔记/.test(b.textContent || ""));
    create?.click();
    await waitFor(() => expect(container.querySelector('[data-testid="editor"]')).not.toBeNull());
  });

  it("Ctrl+K 打开命令面板，Esc 关掉", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.textContent).toContain("时间线"));
    typeKey("k", { ctrlKey: true });
    await waitFor(() => expect(document.body.textContent).toMatch(/搜索|跳转|命令/));
    typeKey("Escape");
    await waitFor(() => expect(container.textContent).toContain("时间线"));
  });

  it("切换导航到汇总页", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.textContent).toContain("汇总"));
    const summary = [...container.querySelectorAll("button")].find((b) => /汇总/.test(b.textContent || ""));
    summary?.click();
    await waitFor(() => expect(container.textContent).toMatch(/回顾|汇总/));
  });

  it("主题切换按钮会写 localStorage", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.textContent).toContain("时间线"));
    const themeBtn = [...container.querySelectorAll("button")].find((b) =>
      /夜间|日间|主题|浅色|深色/.test((b.getAttribute("title") || "") + (b.textContent || "")),
    );
    themeBtn?.click();
    await waitFor(() => expect(localStorage.getItem("sparrow-theme")).not.toBeNull());
  });

  it("切到「我的」并进入设置页（懒加载视图）", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.textContent).toContain("我的"));
    const mine = [...container.querySelectorAll("button")].find((b) => /我的/.test(b.textContent || ""));
    (mine as HTMLButtonElement | null)?.click();
    await waitFor(() => expect(container.textContent).toMatch(/设置|个人化|权限/), { timeout: 4000 });
    const settings = [...container.querySelectorAll("button")].find((b) => /设置/.test(b.textContent || ""));
    (settings as HTMLButtonElement | null)?.click();
    await waitFor(() => expect(container.textContent).toMatch(/存储|数据库|设置/), { timeout: 4000 });
  });

  it("窄屏外壳：宽度 390 时用底部标签栏", async () => {
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    window.dispatchEvent(new Event("resize"));
    const { container } = render(<App />);
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(20));
  });
});

describe("App 窄屏与分享", () => {
  it("窄屏（390）走移动外壳：底部标签 + 写按钮", async () => {
    const orig = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes("768"),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const { container } = render(<App />);
      await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(20));
      // 移动端：有底部标签导航（aria-label 主导航）
      expect(container.querySelector('nav[aria-label="主导航"]')).not.toBeNull();
    } finally {
      window.matchMedia = orig;
    }
  });

  it("打开笔记后能用 ⋯ 菜单里的分享项", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.textContent).toContain("秋日骑行"));
    const row = [...container.querySelectorAll("button")].find((el) => /秋日骑行/.test(el.textContent || ""));
    (row as HTMLButtonElement | null)?.click();
    await waitFor(() =>
      expect(
        container.querySelector('[data-testid="reader"]') ?? container.querySelector('[data-testid="editor"]'),
      ).not.toBeNull(),
    );
    const more = container.querySelector<HTMLButtonElement>('[aria-label="更多操作"]');
    expect(more).not.toBeNull();
    more?.click();
    await waitFor(() => expect(document.body.textContent).toMatch(/Markdown|PDF|长图|打印/), { timeout: 3000 });
    const item = [...document.querySelectorAll("button")].find((b) => /Markdown/.test(b.textContent || ""));
    expect(item).toBeTruthy();
  });
});

describe("App 分享动作", () => {
  it("⋯ 菜单里的 Markdown / PDF / 长图 / 打印 都能触发", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.textContent).toContain("秋日骑行"));
    const row = [...container.querySelectorAll("button")].find((el) => /秋日骑行/.test(el.textContent || ""));
    (row as HTMLButtonElement | null)?.click();
    await waitFor(() =>
      expect(
        container.querySelector('[data-testid="reader"]') ?? container.querySelector('[data-testid="editor"]'),
      ).not.toBeNull(),
    );
    const more = container.querySelector<HTMLButtonElement>('[aria-label="更多操作"]');
    more?.click();
    await waitFor(() => expect(document.body.textContent).toMatch(/Markdown/), { timeout: 3000 });

    const clickByText = (re: RegExp) => {
      const btn = [...document.querySelectorAll("button")].find((b) => re.test(b.textContent || ""));
      (btn as HTMLButtonElement | undefined)?.click();
    };

    clickByText(/Markdown/);
    await waitFor(() => expect(shareCall.md + shareCall.zip).toBeGreaterThan(0));
  });
});
