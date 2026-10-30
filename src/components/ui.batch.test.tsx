// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "../db/notes";

import { BottomTabs } from "./BottomTabs";
import { CommandPalette } from "./CommandPalette";
import { ErrorBoundary } from "./ErrorBoundary";
import { FeatureHint } from "./FeatureHint";
import { Heatmap } from "./Heatmap";
import { NavRail } from "./NavRail";
import { NoteList } from "./NoteList";
import { UndoToast } from "./UndoToast";
import { Viewbar } from "./Viewbar";

const note = (id: string, title: string, date = "2026-10-30"): NoteDoc => ({
  id,
  title,
  date,
  createdAt: 1,
  updatedAt: 1,
  blocks: [] as never,
});

const notes = [note("a", "秋日骑行"), note("b", "本周待办", "2026-10-29")];

describe("Viewbar", () => {
  const desk = {
    navOn: true,
    listOn: true,
    readMode: true,
    locked: false,
    showList: true,
    onToggleNav: () => {},
    onToggleList: () => {},
    onToggleRead: () => {},
    onToggleLock: () => {},
  };
  const share = { onShareMd: () => {}, onSharePdf: () => {} };

  it("渲染开关按钮，点 ⋯ 展开菜单", () => {
    const { container } = render(
      <Viewbar desk={desk} dark={false} onToggleTheme={() => {}} canDelete onDelete={() => {}} share={share} />,
    );
    expect(container.textContent).toMatch(/导航/);
    const more = container.querySelector<HTMLButtonElement>('[aria-label="更多操作"]');
    expect(more).not.toBeNull();
    more?.click();
    // 菜单项来自 ShareMenuItems
    expect((document.body.textContent || "").length).toBeGreaterThan(0);
  });

  it("canDelete=false 时不显示编辑/更多", () => {
    const { container } = render(
      <Viewbar desk={desk} dark onToggleTheme={() => {}} canDelete={false} onDelete={() => {}} share={share} />,
    );
    expect(container.querySelector('[aria-label="更多操作"]')).toBeNull();
  });
});

describe("NavRail", () => {
  it("三个导航项与计数", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <NavRail
        view="timeline"
        notes={notes}
        onNavigate={onNavigate}
        onSearch={() => {}}
        onCreate={() => {}}
        dark={false}
        onToggleTheme={() => {}}
      />,
    );
    expect(container.textContent).toMatch(/时间线/);
    const item = [...container.querySelectorAll("button")].find((b) => /汇总/.test(b.textContent || ""));
    item?.click();
    expect(onNavigate).toHaveBeenCalledWith("summary");
  });
});

describe("BottomTabs", () => {
  it("切换标签回调 onNavigate", () => {
    const onNavigate = vi.fn();
    const { container } = render(<BottomTabs view="timeline" onNavigate={onNavigate} />);
    const tabs = [...container.querySelectorAll("button")];
    expect(tabs.length).toBeGreaterThan(0);
    tabs[tabs.length - 1].click();
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe("UndoToast", () => {
  it("渲染消息并触发 action / dismiss", () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    const { container } = render(
      <UndoToast message="已删除这篇笔记" onAction={onAction} onDismiss={onDismiss} />,
    );
    expect(container.textContent).toContain("已删除这篇笔记");
    const [action, close] = [...container.querySelectorAll("button")];
    action.click();
    close.click();
    expect(onAction).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });

  it("自定义 actionLabel", () => {
    const { container } = render(<UndoToast message="没存上" actionLabel="重试" onAction={() => {}} />);
    expect(container.textContent).toContain("重试");
  });
});

describe("FeatureHint", () => {
  it("data 为 null 时不渲染", () => {
    const { container } = render(<FeatureHint data={null} />);
    expect(container.textContent).toBe("");
  });

  it("给了说明卡就渲染标题与说明", () => {
    const { container } = render(
      <FeatureHint
        data={{ title: "本行上移", desc: "和上面一行交换位置", notes: ["别连续点两次"] }}
      />,
    );
    expect(document.body.textContent).toContain("本行上移");
    expect(container.ownerDocument.body.textContent).toContain("交换位置");
  });
});

describe("Heatmap", () => {
  const cells = Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-0${i + 1}`, count: i }));
  it("渲染格子并支持点选", () => {
    const onPickDate = vi.fn();
    const { container } = render(<Heatmap cells={cells} onPickDate={onPickDate} />);
    const btns = [...container.querySelectorAll("button")];
    expect(btns.length).toBeGreaterThan(0);
    btns[2].click();
    expect(onPickDate).toHaveBeenCalled();
  });
});

describe("NoteList", () => {
  it("列出标题并能打开", () => {
    const onOpen = vi.fn();
    const { container } = render(
      <NoteList
        notes={notes}
        activeId={null}
        query=""
        onQueryChange={() => {}}
        onOpenNote={onOpen}
        onDeleteNote={() => {}}
        onCreate={() => {}}
      />,
    );
    expect(container.textContent).toContain("秋日骑行");
    // 条目是 role=button 的 div（里面还有删除按钮），按文本找外层
    const row = [...container.querySelectorAll('[role="button"]')].find((el) =>
      /秋日骑行/.test(el.textContent || ""),
    );
    expect(row).toBeTruthy();
    (row as HTMLElement | null)?.click();
    expect(onOpen).toHaveBeenCalled();
  });
});

describe("CommandPalette", () => {
  it("打开时列出匹配笔记，关闭时不渲染", () => {
    const onOpenNote = vi.fn();
    const { container, rerender } = render(
      <CommandPalette
        open
        notes={notes}
        query="秋日"
        onQueryChange={() => {}}
        onOpenNote={onOpenNote}
        onClose={() => {}}
      />,
    );
    const item = [...container.querySelectorAll("button")].find((b) => /秋日骑行/.test(b.textContent || ""));
    expect(item).toBeTruthy();
    item?.click();
    expect(onOpenNote).toHaveBeenCalled();

    rerender(
      <CommandPalette
        open={false}
        notes={notes}
        query=""
        onQueryChange={() => {}}
        onOpenNote={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.textContent).toBe("");
  });
});

/** 触发渲染期异常的小组件 */
class Boom extends Component<{ children?: ReactNode }> {
  render(): ReactNode {
    throw new Error("故意抛错");
  }
}

describe("ErrorBoundary", () => {
  it("子组件抛错时显示兜底页", () => {
    // React 会把错误打到 console.error，测试里静音
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(container.textContent).toMatch(/这一步没走通|出错了/);
    spy.mockRestore();
  });

  it("正常子组件原样渲染", () => {
    const { container } = render(
      <ErrorBoundary>
        <span>正常内容</span>
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain("正常内容");
  });
});
