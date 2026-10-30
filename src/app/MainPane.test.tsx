// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "../db/notes";
import { MainPane, type MainPaneProps } from "./MainPane";

const note = (id: string, extra: Partial<NoteDoc> = {}): NoteDoc => ({
  id,
  title: "秋日骑行",
  date: "2026-10-29",
  createdAt: 1,
  updatedAt: 1,
  blocks: [],
  ...extra,
});

function props(extra: Partial<MainPaneProps> = {}): MainPaneProps {
  return {
    active: null,
    view: "timeline",
    isNarrow: false,
    readMode: true,
    saveState: "idle",
    shareHint: null,
    noteNumber: 0,
    prevNote: null,
    nextNote: null,
    listOn: true,
    recent: [],
    visibleNotes: [],
    query: "",
    dateFilter: "",
    profilePage: null,
    dark: false,
    dateInputRef: { current: null },
    onOpenDatePicker: () => {},
    onUpdateNote: () => {},
    markSave: () => {},
    onTitleChange: () => {},
    onBlocksChange: () => {},
    onOpenNote: () => {},
    onCreate: () => {},
    onToggleList: () => {},
    onQueryChange: () => {},
    onDateChange: () => {},
    onOpenDrawer: () => {},
    onProfilePage: () => {},
    onNavigate: () => {},
    onToggleChecklist: () => {},
    onDataCleared: () => {},
    onToggleTheme: () => {},
    ...extra,
  };
}

describe("MainPane", () => {
  it("没有选中笔记时显示空态（桌面）", () => {
    const { container } = render(<MainPane {...props()} />);
    expect(container.textContent).toContain("从目录里选一篇");
    expect(container.textContent).toContain("写一条");
  });

  it("目录收起时空态文案改成「目录收起来了」并给「打开目录」", () => {
    const onToggleList = vi.fn();
    const { container } = render(<MainPane {...props({ listOn: false, onToggleList })} />);
    expect(container.textContent).toContain("目录收起来了");
    const btn = [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes("打开目录"));
    expect(btn).toBeTruthy();
    btn?.click();
    expect(onToggleList).toHaveBeenCalledWith(true);
  });

  it("空态里给出最近几篇，点一下回调 onOpenNote", () => {
    const onOpenNote = vi.fn();
    const { container } = render(
      <MainPane {...props({ listOn: false, recent: [note("a")], onOpenNote })} />,
    );
    expect(container.textContent).toContain("最近 1 篇");
    const item = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("秋日骑行"),
    );
    item?.click();
    expect(onOpenNote).toHaveBeenCalledWith("a");
  });

  it("点「写一条」触发 onCreate", () => {
    const onCreate = vi.fn();
    const { container } = render(<MainPane {...props({ onCreate })} />);
    const btn = [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes("写一条"));
    btn?.click();
    expect(onCreate).toHaveBeenCalled();
  });

  it("recent 为空时不渲染「最近 N 篇」区块", () => {
    // recent 由 App 决定（目录开着时给空数组），这里只验渲染条件
    const { container } = render(<MainPane {...props({ listOn: true, recent: [] })} />);
    expect(container.textContent).toContain("从目录里选一篇");
    expect(container.textContent).not.toContain("最近 0 篇");
  });
});

describe("MainPane 视图分支", () => {
  const blocks = [
    {
      id: "b1",
      type: "paragraph",
      props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [{ type: "text", text: "正文", styles: {} }],
      children: [],
    },
  ];
  const active = note("a", { blocks: blocks as never, title: "秋日骑行" });

  it("选中笔记 + 阅读态 → 阅读器", async () => {
    const { container } = render(<MainPane {...props({ active, readMode: true })} />);
    await waitFor(() => expect(container.textContent).toContain("秋日骑行"), { timeout: 4000 });
  });

  it("选中笔记 + 编辑态 → 标题输入框 + 编辑器", async () => {
    const { container } = render(<MainPane {...props({ active, readMode: false })} />);
    await waitFor(() => expect(container.querySelector(".bn-editor")).not.toBeNull(), { timeout: 5000 });
    const titleInput = container.querySelector('input[placeholder="无标题"]');
    expect(titleInput).not.toBeNull();
  });

  it("窄屏时间线走 TimelineView", async () => {
    const { container } = render(
      <MainPane {...props({ isNarrow: true, visibleNotes: [note("a")] })} />,
    );
    // TimelineView 首屏文案是「Sparrow Note · N 篇」+ 日期分组
    expect(container.textContent).toMatch(/Sparrow Note|20\d\d 年/);
  });

  it("汇总 / 清单 / 我的 三个视图都能渲染", async () => {
    const summary = render(<MainPane {...props({ view: "summary", visibleNotes: [note("a")] })} />);
    expect((summary.container.textContent || "").length).toBeGreaterThan(10);
    summary.unmount();

    const checklist = render(<MainPane {...props({ view: "checklist", visibleNotes: [note("a")] })} />);
    expect((checklist.container.textContent || "").length).toBeGreaterThan(10);
    checklist.unmount();

    const profile = render(<MainPane {...props({ view: "profile", visibleNotes: [note("a")] })} />);
    expect((profile.container.textContent || "").length).toBeGreaterThan(10);
  });

  it("设置页分支（懒加载）能渲染", async () => {
    const { container } = render(
      <MainPane {...props({ profilePage: "settings", visibleNotes: [note("a")] })} />,
    );
    await waitFor(() => expect(container.textContent).toMatch(/存储|设置/), { timeout: 4000 });
  });
});

describe("MainPane 懒加载视图", () => {
  for (const page of ["personalize", "permissions", "about"] as const) {
    it(`profilePage=${page} 能加载出来`, async () => {
      const { container } = render(
        <MainPane {...props({ profilePage: page, visibleNotes: [note("a")] })} />,
      );
      await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(15), {
        timeout: 4000,
      });
    });
  }
});
