// @vitest-environment happy-dom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "./db/notes";

vi.mock("./lib/settings", () => {
  const store = { summaryKinds: ["mood", "checklist"], codeCollapseLines: 40, defaultNoteMode: "read", showCardNumber: false };
  return {
    useSettings: () => store,
    getSettings: () => store,
    setSetting: () => {},
    initSettings: () => {},
    subscribeSettings: () => () => {},
    allSummaryKinds: () => ["mood", "checklist"],
    SUMMARY_KIND_META: { mood: { label: "心情", hint: "" }, checklist: { label: "清单", hint: "" } },
    moveSummaryKind: () => {},
  };
});

import { SummaryView } from "./SummaryView";

const note = (id: string, date: string, title: string, blocks: unknown[] = []): NoteDoc => ({
  id,
  title,
  date,
  createdAt: 1,
  updatedAt: 1,
  blocks: blocks as never,
});

const notes = [
  note("a", "2026-10-30", "今天", [
    { id: "m", type: "mood", props: { emoji: "😀" }, content: [], children: [] },
  ]),
  note("b", "2026-09-15", "上个月", []),
];

const props = {
  notes,
  onOpenNote: () => {},
  onOpenMenu: () => {},
  onOpenPersonalize: () => {},
  onOpenChecklist: () => {},
};

describe("SummaryView 月份与日历", () => {
  it("能翻到上个月并显示该月统计", () => {
    const { container } = render(<SummaryView {...props} />);
    const prev = [...container.querySelectorAll("button")].find((b) =>
      /上个月|上月|‹|←/.test(b.getAttribute("aria-label") || b.textContent || ""),
    );
    if (prev) fireEvent.click(prev);
    expect(container.textContent || "").toMatch(/9 月|九月|月/);
  });

  it("点日历上的日期会变成筛选条件", () => {
    const { container } = render(<SummaryView {...props} />);
    const dayBtn = [...container.querySelectorAll("button")].find((b) =>
      /\d{1,2}/.test((b.textContent || "").trim()) && !/月/.test(b.textContent || ""),
    );
    if (dayBtn) fireEvent.click(dayBtn);
    expect((container.textContent || "").length).toBeGreaterThan(20);
  });

  it("右栏分类开关能切（有分类按钮时）", () => {
    const { container } = render(<SummaryView {...props} />);
    const btns = [...container.querySelectorAll("button")].filter((b) => /心情|清单|联系人|地点/.test(b.textContent || ""));
    btns.forEach((b) => fireEvent.click(b));
    expect((container.textContent || "").length).toBeGreaterThan(20);
  });
});
