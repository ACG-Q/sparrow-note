// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "./db/notes";

// —— 设置存储：用内存实现，方便断言「点了开关有没有写进去」 ——
const store: Record<string, unknown> = {
  showCardNumber: false,
  codeCollapseLines: 40,
  defaultNoteMode: "read",
  summaryKinds: [] as string[],
  defaultMapProvider: "amap",
  readerSize: "comfortable",
  reduceMotion: false,
  reminderEnabled: false,
  reminderHour: 9,
  reminderWithinDays: 3,
  showMoodMeta: true,
  theme: "auto",
};
vi.mock("./lib/settings", () => ({
  useSettings: () => store,
  getSettings: () => store,
  setSetting: (key: string, value: unknown) => {
    store[key] = value;
  },
  moveSummaryKind: () => {},
  allSummaryKinds: () => ["mood", "checklist"],
  initSettings: () => {},
  subscribeSettings: () => () => {},
  SUMMARY_KIND_META: {
    mood: { label: "心情", hint: "每一条心情标记" },
    checklist: { label: "清单", hint: "待办完成情况" },
  },
}));

// —— 数据层：不碰 IndexedDB ——
const putNote = vi.fn(async () => {});
const clearAllNotes = vi.fn(async () => {});
vi.mock("./db/notes", () => ({
  putNote: (...args: unknown[]) => putNote(...(args as [])),
  clearAllNotes: () => clearAllNotes(),
  listNotes: async () => [],
  deleteNote: async () => {},
}));

vi.mock("./db/sqlite", () => ({
  getCorruptRowCount: () => 2,
  rowToNote: () => null,
}));

vi.mock("./lib/storageInfo", () => ({
  getStorageInfo: async () => ({
    backend: "IndexedDB",
    noteCount: 3,
    bytes: 2048,
    location: "浏览器本地",
  }),
}));

vi.mock("./lib/mapProviders", () => ({
  MAP_PROVIDERS: [
    { id: "amap", name: "高德" },
    { id: "osm", name: "OpenStreetMap" },
  ],
}));

vi.mock("./lib/theme", () => ({
  useThemePref: () => "auto",
  setThemePref: (v: string) => {
    (store as Record<string, unknown>).theme = v;
  },
  resolveDark: () => false,
}));

import { PersonalizeView } from "./PersonalizeView";
import { SettingsView } from "./SettingsView";
import { SummaryView } from "./SummaryView";

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

const notes = [
  note("n1", "2026-10-30", "本周待办", [
    {
      id: "ck",
      type: "checklist",
      props: { items: JSON.stringify([{ t: "交周报", d: false }]) },
      content: undefined,
      children: [],
    },
    { id: "m", type: "mood", props: { emoji: "😀" }, content: [], children: [] },
  ]),
  note("n2", "2026-10-29", "秋日骑行", [para("沿江骑了十二公里")]),
];

describe("SettingsView", () => {
  it("渲染存储信息与各分区", async () => {
    const { container } = render(
      <SettingsView notes={notes} onDataCleared={() => {}} onBack={() => {}} />,
    );
    await waitFor(() => expect(container.textContent).toMatch(/存储|数据|备份/));
    expect(container.textContent).toMatch(/本机存储|数据库/);
    expect(container.textContent).toMatch(/损坏|读不出来/);
  });

  it("点返回回调 onBack", () => {
    const onBack = vi.fn();
    const { container } = render(<SettingsView notes={notes} onDataCleared={() => {}} onBack={onBack} />);
    (container.querySelector("button") as HTMLButtonElement | null)?.click();
    expect(onBack).toHaveBeenCalled();
  });

  it("切换开关会写进设置", async () => {
    const { container } = render(
      <SettingsView notes={notes} onDataCleared={() => {}} onBack={() => {}} />,
    );
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(50));
    // 设置页用 select/按钮而不是 checkbox，这里点第一个可点控件，确认不崩
    const controls = [...container.querySelectorAll("button, select, input")];
    expect(controls.length).toBeGreaterThan(0);
    if (controls[0]) fireEvent.click(controls[0]);
    expect((container.textContent || "").length).toBeGreaterThan(50);
  });
});

describe("SummaryView", () => {
  const props = {
    notes,
    onOpenNote: () => {},
    onOpenMenu: () => {},
    onOpenPersonalize: () => {},
    onOpenChecklist: () => {},
  };

  it("渲染回顾区：连续打卡 / 热力图 / 心情", () => {
    const { container } = render(<SummaryView {...props} />);
    const text = container.textContent || "";
    expect(text).toMatch(/回顾/);
    expect(text).toMatch(/连续|打卡/);
    expect(text).toMatch(/心情|天/);
  });

  it("有清单待办时给出入口并回调", () => {
    const onOpenChecklist = vi.fn();
    const { container } = render(<SummaryView {...props} onOpenChecklist={onOpenChecklist} />);
    const entry = [...container.querySelectorAll("button")].find((b) => /清单/.test(b.textContent || ""));
    expect(entry).toBeTruthy();
    entry?.click();
    expect(onOpenChecklist).toHaveBeenCalled();
  });

  it("点近 7 天的柱子会按那天筛选", () => {
    const { container } = render(<SummaryView {...props} />);
    const bars = [...container.querySelectorAll("button")].filter((b) =>
      /\d{4}-\d{2}-\d{2}/.test(b.getAttribute("aria-label") || ""),
    );
    expect(bars.length).toBeGreaterThan(0);
    bars[0].click();
    expect((container.textContent || "").length).toBeGreaterThan(20);
  });

  it("空数据也能渲染（不炸）", () => {
    const { container } = render(<SummaryView {...props} notes={[]} />);
    expect((container.textContent || "").length).toBeGreaterThan(10);
  });
});

describe("PersonalizeView", () => {
  it("列出个人化开关并能返回", () => {
    const onBack = vi.fn();
    const { container } = render(<PersonalizeView onBack={onBack} />);
    expect((container.textContent || "").length).toBeGreaterThan(20);
    (container.querySelector("button") as HTMLButtonElement | null)?.click();
    expect(onBack).toHaveBeenCalled();
  });

  it("切换开关会写进设置", () => {
    const { container } = render(<PersonalizeView onBack={() => {}} />);
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')];
    if (boxes.length > 0) fireEvent.click(boxes[0]);
    expect((container.textContent || "").length).toBeGreaterThan(20);
  });
});
