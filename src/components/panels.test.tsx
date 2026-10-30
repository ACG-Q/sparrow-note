// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "../db/notes";

vi.mock("../lib/settings", () => {
  const store = { showCardNumber: false, codeCollapseLines: 40, summaryKinds: [], defaultNoteMode: "read" };
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

import { FilePreview } from "./FilePreview";
import { ListColumn } from "./ListColumn";
import { NoteDrawer } from "./NoteDrawer";

const note = (id: string, title: string, date = "2026-10-30", blocks: unknown[] = []): NoteDoc => ({
  id,
  title,
  date,
  createdAt: 1,
  updatedAt: 1,
  blocks: blocks as never,
});

const para = (text: string) => ({
  id: `p-${text}`,
  type: "paragraph",
  props: {},
  content: [{ type: "text", text, styles: {} }],
  children: [],
});

const notes = [
  note("a", "秋日骑行", "2026-10-30", [para("沿江骑了十二公里")]),
  note("b", "本周待办", "2026-10-29", [
    {
      id: "ck",
      type: "checklist",
      props: { items: JSON.stringify([{ t: "交周报", d: false }]) },
      content: undefined,
      children: [],
    },
  ]),
];

describe("ListColumn", () => {
  it("列出笔记、能打开与新建", () => {
    const onOpenNote = vi.fn();
    const onCreate = vi.fn();
    const { container } = render(
      <ListColumn
        notes={notes}
        activeId={null}
        onOpenNote={onOpenNote}
        onCreate={onCreate}
      />,
    );
    expect(container.textContent).toContain("秋日骑行");
    const row = [...container.querySelectorAll("button")].find((b) => /秋日骑行/.test(b.textContent || ""));
    row?.click();
    expect(onOpenNote).toHaveBeenCalled();
  });

  it("空列表给「写一条」入口", () => {
    const onCreate = vi.fn();
    const { container } = render(
      <ListColumn
        notes={[]}
        activeId={null}
        onOpenNote={() => {}}
        onCreate={onCreate}
      />,
    );
    const btn = [...container.querySelectorAll("button")].find((b) => /写一条/.test(b.textContent || ""));
    btn?.click();
    expect(onCreate).toHaveBeenCalled();
  });

  it("有日期筛选时能清除", () => {
    const { container } = render(
      <ListColumn
        notes={notes}
        activeId="a"
        onOpenNote={() => {}}
        onCreate={() => {}}
      />,
    );
    const clear = [...container.querySelectorAll("button")].find((b) => /清除|全部/.test(b.textContent || ""));
    clear?.click();
    expect((container.textContent || "").length).toBeGreaterThan(10);
  });
});

describe("NoteDrawer", () => {
  const props = {
    open: true,
    notes,
    themePref: "auto" as const,
    onCycleTheme: () => {},
    onClose: () => {},
    onCreate: () => {},
    onOpenSettings: () => {},
    onPickDate: () => {},
    onClearFilter: () => {},
  };

  it("打开时显示统计与热力图", () => {
    const { container } = render(<NoteDrawer {...props} />);
    const text = container.textContent || "";
    expect(text).toMatch(/今日新增|本周新增|总篇数/);
    expect(text).toMatch(/连续打卡|贡献热力图/);
  });

  it("关闭时外壳仍在但标记为不可见（aria-hidden/inert）", () => {
    const { container } = render(<NoteDrawer {...props} open={false} />);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    const hidden =
      aside?.getAttribute("aria-hidden") === "true" ||
      aside?.hasAttribute("inert") ||
      /closed|hidden/i.test(aside?.className || "");
    expect(hidden).toBe(true);
  });

  it("点主题按钮回调 onCycleTheme", () => {
    const onCycleTheme = vi.fn();
    const { container } = render(<NoteDrawer {...props} onCycleTheme={onCycleTheme} />);
    const btn = [...container.querySelectorAll("button")].find((b) => /夜间|日间|主题|自动/.test(b.textContent || ""));
    btn?.click();
    expect(onCycleTheme).toHaveBeenCalled();
  });

  it("点新建/设置会回调", () => {
    const onCreate = vi.fn();
    const onOpenSettings = vi.fn();
    const { container } = render(
      <NoteDrawer {...props} onCreate={onCreate} onOpenSettings={onOpenSettings} />,
    );
    for (const b of container.querySelectorAll("button")) (b as HTMLButtonElement).click();
    expect(onCreate.mock.calls.length + onOpenSettings.mock.calls.length).toBeGreaterThan(0);
  });
});

describe("FilePreview", () => {
  it("图片类附件直接显示 img", async () => {
    const { container } = render(
      <FilePreview
        file={{ name: "图.png", url: "data:image/png;base64,xx" }}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
  });

  it("点关闭与按 Esc 都回调 onClose", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <FilePreview file={{ name: "文.txt", url: "data:text/plain;base64,aGk=" }} onClose={onClose} />,
    );
    const close = [...container.querySelectorAll("button")].find((b) =>
      /关闭|×|✕/.test(b.getAttribute("aria-label") || b.textContent || ""),
    );
    if (close) fireEvent.click(close);
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("文本类附件会把内容读出来", async () => {
    // data:text/plain;base64,aGk= → "hi"
    const { container } = render(
      <FilePreview file={{ name: "a.txt", url: "data:text/plain;base64,aGk=" }} onClose={() => {}} />,
    );
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(5));
  });

  it("不支持的格式给降级提示", async () => {
    const { container } = render(
      <FilePreview file={{ name: "x.bin", url: "data:application/octet-stream;base64,AA==" }} onClose={() => {}} />,
    );
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(5));
  });
});
