// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "./db/notes";

// —— 设置存储 ——
const store: Record<string, unknown> = {
  defaultMapProvider: "amap",
  codeCollapseLines: 40,
  defaultNoteMode: "read",
  showCardNumber: false,
  summaryKinds: [],
};
const setSetting = vi.fn((k: string, v: unknown) => {
  store[k] = v;
});
vi.mock("./lib/settings", () => ({
  useSettings: () => store,
  getSettings: () => store,
  setSetting: (k: string, v: unknown) => setSetting(k, v),
  initSettings: () => {},
  subscribeSettings: () => () => {},
  allSummaryKinds: () => ["mood", "checklist"],
  SUMMARY_KIND_META: { mood: { label: "心情", hint: "" }, checklist: { label: "清单", hint: "" } },
  moveSummaryKind: () => {},
}));

// —— 数据层 ——
const clearAllNotes = vi.fn(async () => {});
const putNote = vi.fn(async () => {});
vi.mock("./db/notes", () => ({
  clearAllNotes: () => clearAllNotes(),
  putNote: (...a: unknown[]) => putNote(...(a as [])),
  listNotes: async () => [],
  deleteNote: async () => {},
  isTauri: () => false,
}));
vi.mock("./db/sqlite", () => ({ getCorruptRowCount: () => 0, rowToNote: () => null }));

// —— 存储信息 / 地图 / 备份包 ——
vi.mock("./lib/storageInfo", () => ({
  getStorageInfo: async () => ({ backend: "IndexedDB", noteCount: 2, bytes: 4096, location: "浏览器" }),
}));
vi.mock("./lib/mapProviders", () => ({
  MAP_PROVIDERS: [
    { id: "amap", label: "高德", attribution: "高德", coordSystem: "gcj02", maxZoom: 18, tileUrl: () => "", note: "" },
    { id: "osm", label: "OpenStreetMap", attribution: "OSM", coordSystem: "wgs84", maxZoom: 19, tileUrl: () => "" },
  ],
}));

const buildPackage = vi.fn(async (...args: unknown[]) => {
  const opts = (args[1] ?? {}) as { textOnly?: boolean };
  return {
  bytes: new Uint8Array([1, 2, 3]),
    format: { counts: { notes: 2, assets: opts.textOnly ? 0 : 1 } },
  };
});
const readPackage = vi.fn(async (...args: unknown[]) => {
  const file = args[0] as File;
  if (file.name.includes("bad")) return { ok: false, reason: "压缩包损坏" };
  return {
    ok: true,
    notes: [
      {
        schema: "sparrow/note",
        version: 1,
        id: "x",
        title: "导入的笔记",
        date: "2026-10-30",
        createdAt: 1,
        updatedAt: 1,
        blocks: [],
      },
    ],
    format: { counts: { notes: 1, assets: 0, bytes: 10 } },
    report: { total: 1, imported: 1, skipped: 0, failed: [], warnings: [], missingAssets: 0, unknownBlocks: 0 },
    warnings: [],
    missingAssets: 0,
    unknownBlocks: 0,
  };
});
const mergeNotes = vi.fn((..._a: unknown[]) => ({ toWrite: [], skipped: 1 }));
vi.mock("./lib/sparrowPackage", () => ({
  buildPackage: (...a: unknown[]) => buildPackage(...(a as [NoteDoc[], { textOnly?: boolean }])),
  readPackage: (...a: unknown[]) => readPackage(...(a as [File])),
  bytesToBlob: (..._a: unknown[]) => new Blob(["x"]),
  suggestFileName: (..._a: unknown[]) => "backup.sparrow",
  mergeNotes: (...a: unknown[]) => mergeNotes(...(a as [])),
  canonicalNoteToNote: () => ({
    id: "x",
    title: "导入的笔记",
    date: "2026-10-30",
    createdAt: 1,
    updatedAt: 1,
    blocks: [],
  }),
}));

vi.stubGlobal("confirm", () => true);

beforeAll(() => {
  vi.stubGlobal("confirm", () => true);
});

import { SettingsView } from "./SettingsView";

const notes: NoteDoc[] = [
  { id: "a", title: "秋日骑行", date: "2026-10-30", createdAt: 1, updatedAt: 1, blocks: [] },
];

const setup = (over: Partial<Parameters<typeof SettingsView>[0]> = {}) =>
  render(
    <SettingsView
      notes={notes}
      onDataCleared={() => {}}
      onBack={() => {}}
      {...over}
    />,
  );

describe("SettingsView 数据区", () => {
  it("导出完整备份会调用 buildPackage 并提示", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/数据/));
    const btn = [...container.querySelectorAll("button")].find((b) => /完整备份|导出/.test(b.textContent || ""));
    expect(btn).toBeTruthy();
    btn?.click();
    await waitFor(() => expect(buildPackage).toHaveBeenCalled());
  });

  it("导出仅文字备份走 textOnly", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/数据/));
    const btn = [...container.querySelectorAll("button")].find((b) => /仅文字/.test(b.textContent || ""));
    btn?.click();
    await waitFor(() =>
      expect(buildPackage.mock.calls.some((c) => (c[1] as { textOnly?: boolean }).textOnly)).toBe(true),
    );
  });

  it("选择坏备份包会显示原因", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/数据/));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    if (input) {
      const file = new File(["x"], "bad.sparrow");
      fireEvent.change(input, { target: { files: [file] } });
    }
    await waitFor(() => expect(container.textContent).toMatch(/损坏|失败|无法/), { timeout: 3000 });
  });

  it("选中正常备份包会进入确认态，确认后导入", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/数据/));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) fireEvent.change(input, { target: { files: [new File(["x"], "good.sparrow")] } });
    await waitFor(() => expect(container.textContent).toMatch(/导入|确认/), { timeout: 3000 });
    const confirm = [...container.querySelectorAll("button")].find((b) => /确认导入|开始导入/.test(b.textContent || ""));
    if (confirm) confirm.click();
    await waitFor(() => expect(mergeNotes).toHaveBeenCalled());
  });

  it("清空数据会先确认再调用 clearAllNotes", async () => {
    const onDataCleared = vi.fn();
    const { container } = setup({ onDataCleared });
    await waitFor(() => expect(container.textContent).toMatch(/数据/));
    const danger = [...container.querySelectorAll("button")].find((b) => /清空/.test(b.textContent || ""));
    expect(danger).toBeTruthy();
    danger?.click();
    await waitFor(() => expect(clearAllNotes).toHaveBeenCalled(), { timeout: 3000 });
  });

  it("地图来源可切换并写入设置", async () => {
    const { container } = setup();
    await waitFor(() => expect(container.textContent).toMatch(/地图/));
    const btns = [...container.querySelectorAll("button")].filter((b) => /高德|OpenStreetMap|amap|osm/i.test(b.textContent || ""));
    expect(btns.length).toBeGreaterThan(0);
    btns[btns.length - 1].click();
    expect(setSetting).toHaveBeenCalled();
  });
});
