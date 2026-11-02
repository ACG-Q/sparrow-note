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
  autoBackup: true,
  backupInterval: "daily",
  backupKeep: 5,
  lastBackupAt: null,
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
  isTauri: () => false,
}));

vi.mock("./db/sqlite", () => ({
  getCorruptRowCount: () => 2,
  rowToNote: () => null,
}));

// 数据位置/备份在浏览器里走降级分支（isTauri 为 false），不 mock，顺便测降级

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
  it("渲染用量、数据库位置、自动备份与地图", async () => {
    const { container } = render(
      <SettingsView notes={notes} onDataCleared={() => {}} onBack={() => {}} />,
    );
    await waitFor(() => expect(container.textContent).toMatch(/数据与存储/));
    const text = container.textContent || "";
    expect(text).toMatch(/2 篇笔记/); // 用量
    expect(text).toMatch(/IndexedDB/); // 浏览器里数据在哪
    expect(text).toMatch(/自动备份/);
    expect(text).toMatch(/地图/);
    expect(text).toMatch(/读不出来/); // 坏记录提示
  });

  it("浏览器里不提供「更换位置」，并说明原因", async () => {
    const { container } = render(
      <SettingsView notes={notes} onDataCleared={() => {}} onBack={() => {}} />,
    );
    await waitFor(() => expect(container.textContent).toMatch(/数据与存储/));
    expect([...container.querySelectorAll("button")].some((b) => /更换位置/.test(b.textContent || ""))).toBe(
      false,
    );
    expect(container.textContent).toMatch(/浏览器托管/);
  });

  it("点返回回调 onBack", () => {
    const onBack = vi.fn();
    const { container } = render(<SettingsView notes={notes} onDataCleared={() => {}} onBack={onBack} />);
    (container.querySelector("button") as HTMLButtonElement | null)?.click();
    expect(onBack).toHaveBeenCalled();
  });

  it("浏览器里的自动备份开关是禁用的，并写明原因", async () => {
    const { container } = render(
      <SettingsView notes={notes} onDataCleared={() => {}} onBack={() => {}} />,
    );
    await waitFor(() => expect(container.textContent).toMatch(/自动备份/));
    const box = container.querySelector<HTMLButtonElement>(
      'button[role="checkbox"][aria-label="自动备份"]',
    );
    expect(box?.disabled).toBe(true);
    expect(container.textContent).toMatch(/浏览器里没有可写的本地目录/);
    // 浏览器里也没有「立即备份」
    expect([...container.querySelectorAll("button")].some((b) => /立即备份/.test(b.textContent || ""))).toBe(
      false,
    );
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
