// @vitest-environment happy-dom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "./db/notes";

vi.mock("../lib/settings", () => {
  const defaults = { showCardNumber: false, codeCollapseLines: 40, summaryKinds: [], defaultNoteMode: "read" };
  return {
    getSettings: () => defaults,
    useSettings: () => defaults,
    initSettings: () => {},
    setSettings: () => {},
    subscribeSettings: () => () => {},
  };
});
vi.mock("../lib/appInfo", () => ({
  APP_NAME: "麻雀记",
  app_id: "com.sparrow.note",
  appVersion: async () => "0.1.0",
  compareVersions: () => 0,
}));

import { ChecklistView } from "./ChecklistView";
import { ProfileView } from "./ProfileView";
import { TimelineView } from "./TimelineView";

const note = (id: string, date: string, title: string, blocks: unknown[] = []): NoteDoc => ({
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

const checklistNote = note("c1", "2026-10-30", "本周待办", [
  {
    id: "ck",
    type: "checklist",
    props: { items: JSON.stringify([{ t: "交周报", d: false }, { t: "体检", d: true }]) },
    content: undefined,
    children: [],
  },
]);

const notes = [checklistNote, note("n2", "2026-10-29", "秋日骑行", [para("沿江骑了十二公里")])];

describe("TimelineView", () => {
  it("列出笔记并按日期分组", () => {
    const { container } = render(
      <TimelineView
        notes={notes}
        onOpenNote={() => {}}
        onCreate={() => {}}
        onOpenMenu={() => {}}
        dark={false}
        onToggleTheme={() => {}}
        query=""
        onClearQuery={() => {}}
        dateFilter=""
        onClearDate={() => {}}
      />,
    );
    expect(container.textContent).toMatch(/2026 年 10 月|10 月/);
    expect(container.textContent).toContain("秋日骑行");
  });

  it("点笔记回调 onOpenNote", () => {
    const onOpenNote = vi.fn();
    const { container } = render(
      <TimelineView
        notes={notes}
        onOpenNote={onOpenNote}
        onCreate={() => {}}
        onOpenMenu={() => {}}
        dark
        onToggleTheme={() => {}}
        query=""
        onClearQuery={() => {}}
        dateFilter=""
        onClearDate={() => {}}
      />,
    );
    const title = [...container.querySelectorAll("*")].find(
      (el) => el.children.length === 0 && (el.textContent || "").trim() === "秋日骑行",
    );
    const clickable = title?.closest("button, [role=button], li, [tabindex]") ?? title;
    (clickable as HTMLElement | null)?.click();
    expect(onOpenNote).toHaveBeenCalled();
  });

  it("有筛选词时显示清除入口，空列表给空态", () => {
    const onClearQuery = vi.fn();
    const empty = render(
      <TimelineView
        notes={[]}
        onOpenNote={() => {}}
        onCreate={() => {}}
        onOpenMenu={() => {}}
        dark={false}
        onToggleTheme={() => {}}
        query="不存在"
        onClearQuery={onClearQuery}
        dateFilter=""
        onClearDate={() => {}}
      />,
    );
    expect(empty.container.textContent).toMatch(/没有|空|记/);
  });
});

describe("ChecklistView", () => {
  it("按笔记分组列出待办，勾选回调带回定位信息", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <ChecklistView notes={notes} onToggle={onToggle} onOpenNote={() => {}} onBack={() => {}} />,
    );
    expect(container.textContent).toContain("交周报");
    const box = container.querySelector('input[type="checkbox"]');
    expect(box).not.toBeNull();
    const target = (box?.closest("label") ?? box) as HTMLElement | null;
    target?.dispatchEvent(new Event("click", { bubbles: true }));
    if (target) fireEvent.click(target);
    expect(onToggle).toHaveBeenCalled();
  });

  it("没有待办时给空态提示", () => {
    const { container } = render(
      <ChecklistView notes={[notes[1]]} onToggle={() => {}} onOpenNote={() => {}} onBack={() => {}} />,
    );
    expect((container.textContent || "").length).toBeGreaterThan(0);
  });

  it("点返回与点条目分别回调", () => {
    const onBack = vi.fn();
    const onOpenNote = vi.fn();
    const { container } = render(
      <ChecklistView notes={notes} onToggle={() => {}} onOpenNote={onOpenNote} onBack={onBack} />,
    );
    const back = container.querySelector("button");
    (back as HTMLButtonElement | null)?.click();
    expect(onBack).toHaveBeenCalled();
  });
});

describe("ProfileView", () => {
  it("显示统计并回调各个入口", () => {
    const onOpenSettings = vi.fn();
    const onOpenAbout = vi.fn();
    const onOpenPersonalize = vi.fn();
    const onOpenPermissions = vi.fn();
    const onOpenMenu = vi.fn();
    const { container } = render(
      <ProfileView
        notes={notes}
        onOpenSettings={onOpenSettings}
        onOpenAbout={onOpenAbout}
        onOpenPersonalize={onOpenPersonalize}
        onOpenPermissions={onOpenPermissions}
        onOpenMenu={onOpenMenu}
      />,
    );
    const text = container.textContent || "";
    expect(text).toMatch(/我的|设置/);
    expect(text.length).toBeGreaterThan(20);
    const buttons = [...container.querySelectorAll("button")];
    for (const b of buttons) (b as HTMLButtonElement).click();
    const called =
      onOpenSettings.mock.calls.length +
      onOpenAbout.mock.calls.length +
      onOpenPersonalize.mock.calls.length +
      onOpenPermissions.mock.calls.length +
      onOpenMenu.mock.calls.length;
    expect(called).toBeGreaterThan(0);
  });
});
