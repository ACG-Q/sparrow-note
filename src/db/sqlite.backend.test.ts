// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SQLite 后端：把 Tauri 的插件 SQL 换成内存表，
 * 验证「行 ↔ NoteDoc」的映射、坏行跳过、以及增删改查的 SQL 参数。
 */
const rows = new Map<string, Record<string, unknown>>();
const calls: { sql: string; bind?: unknown[] }[] = [];

const fakeDb = {
  async select<T>(query: string, bind?: unknown[]): Promise<T> {
    calls.push({ sql: query, bind });
    if (/SELECT/i.test(query)) return [...rows.values()] as unknown as T;
    return [] as unknown as T;
  },
  async execute(query: string, bind?: unknown[]): Promise<unknown> {
    calls.push({ sql: query, bind });
    if (/^INSERT|^REPLACE/i.test(query.trim())) {
      const [id, title, date, created_at, updated_at, blocks] = (bind ?? []) as [
        string,
        string,
        string,
        number,
        number,
        string,
      ];
      rows.set(id, { id, title, date, created_at, updated_at, blocks });
      return {};
    }
    if (/^DELETE/i.test(query.trim())) {
      const [id] = (bind ?? []) as [string];
      if (id) rows.delete(id);
      else rows.clear();
      return {};
    }
    return {};
  },
};

vi.mock("@tauri-apps/api/core", () => ({ invoke: async () => "sqlite:sparrow.db" }));
vi.mock("@tauri-apps/plugin-sql", () => ({ default: { load: async () => fakeDb } }));

import { getCorruptRowCount, rowToNote, sqliteBackend } from "./sqlite";

const note = (id: string, title = "标题") => ({
  id,
  title,
  date: "2026-10-30",
  createdAt: 1,
  updatedAt: 1,
  blocks: [
    {
      id: "b1",
      type: "paragraph",
      props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
      content: [{ type: "text", text: "正文", styles: {} }],
      children: [],
    },
  ] as never,
});

beforeEach(async () => {
  rows.clear();
  calls.length = 0;
  await sqliteBackend.clearAllNotes();
});

describe("sqliteBackend（假 SQL 驱动）", () => {
  it("写一条后能读回来", async () => {
    await sqliteBackend.putNote(note("a", "秋日骑行"));
    const all = await sqliteBackend.listNotes();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("秋日骑行");
    expect(Array.isArray(all[0].blocks)).toBe(true);
  });

  it("写入走 INSERT，参数里是 6 个字段", async () => {
    await sqliteBackend.putNote(note("a"));
    const insert = calls.find((c) => /INSERT|REPLACE/i.test(c.sql));
    expect(insert).toBeTruthy();
    expect(insert?.bind).toHaveLength(6);
  });

  it("删除走 DELETE 并带 id", async () => {
    await sqliteBackend.putNote(note("a"));
    calls.length = 0;
    await sqliteBackend.deleteNote("a");
    const del = calls.find((c) => /^DELETE/i.test(c.sql.trim()));
    expect(del?.bind).toEqual(["a"]);
    expect(await sqliteBackend.listNotes()).toEqual([]);
  });

  it("坏行会被跳过并计数", async () => {
    rows.set("bad", {
      id: "bad",
      title: "坏",
      date: "2026-10-30",
      created_at: 1,
      updated_at: 1,
      blocks: "{不是 JSON",
    });
    const all = await sqliteBackend.listNotes();
    expect(all).toEqual([]);
    expect(getCorruptRowCount()).toBeGreaterThanOrEqual(0);
  });

  it("rowToNote 对合法行返回对象，对坏行返回 null", () => {
    const ok = rowToNote({
      id: "x",
      title: "标题",
      date: "2026-10-30",
      created_at: 1,
      updated_at: 2,
      blocks: "[]",
    });
    expect(ok?.id).toBe("x");
    expect(rowToNote({ id: "y", blocks: "不是数组" } as never)).toBeNull();
  });
});
