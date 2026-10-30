import { describe, expect, it } from "vitest";
import type { NoteDoc } from "../db/notes";
import { collectSummary, entriesOnDate, noteMatchesQuery } from "./aggregate";

function note(over: Partial<NoteDoc> = {}): NoteDoc {
  return { id: "n1", title: "", date: "2026-10-14", createdAt: 0, updatedAt: 0, blocks: [], ...over };
}

describe("entriesOnDate", () => {
  it("returns all entries when the date filter is empty", () => {
    const entries = [{ noteDate: "2026-10-01" }, { noteDate: "2026-10-02" }];
    expect(entriesOnDate(entries, "")).toEqual(entries);
  });

  it("keeps only entries matching the date", () => {
    const entries = [{ noteDate: "2026-10-01" }, { noteDate: "2026-10-02" }];
    expect(entriesOnDate(entries, "2026-10-02")).toEqual([{ noteDate: "2026-10-02" }]);
  });
});

describe("noteMatchesQuery", () => {
  it("matches every note on empty query", () => {
    expect(noteMatchesQuery(note(), "   ")).toBe(true);
  });

  it("matches the title case-insensitively", () => {
    expect(noteMatchesQuery(note({ title: "Hello World" }), "hello")).toBe(true);
  });

  it("rejects notes that match nothing", () => {
    expect(noteMatchesQuery(note({ title: "周报" }), "天气")).toBe(false);
  });
});

const blk = (partial: Record<string, unknown>) =>
  ({ id: "b", children: [], props: {}, content: [], ...partial }) as never;

function richNote(): NoteDoc {
  return note({
    id: "rich",
    title: "多块",
    date: "2026-10-20",
    blocks: [
      blk({ type: "location", props: { name: "闻涛路", addr: "杭州 · 滨江", coord: "30.1,120.1" } }),
      blk({
        type: "checklist",
        props: {
          items: JSON.stringify([
            { t: "买菜", d: false },
            { t: "洗碗", d: true },
            { t: "  ", d: false },
          ]),
        },
      }),
      blk({ type: "bookmark", props: { title: "麻雀记文档", url: "https://example.com" } }),
      blk({ type: "account", props: { site: "GitHub", user: "liu", pass: "x" } }),
      blk({ type: "bankcard", props: { bank: "招商银行", kind: "储蓄卡", no: "6225880000006789" } }),
    ],
    children: [],
  } as never);
}

describe("collectSummary", () => {
  it("地点：名称、地址、有无坐标", () => {
    const [row] = collectSummary([richNote()], "location");
    expect(row.primary).toBe("闻涛路");
    expect(row.secondary).toBe("杭州 · 滨江");
    expect(row.right).toBe("有坐标");
  });

  it("清单：每项一行，空项丢掉，带完成状态", () => {
    const rows = collectSummary([richNote()], "checklist");
    expect(rows.map((r) => r.primary)).toEqual(["买菜", "洗碗"]);
    expect(rows[0].done).toBe(false);
    expect(rows[1].done).toBe(true);
    expect(rows[1].right).toBe("已完成");
  });

  it("书签与账号", () => {
    expect(collectSummary([richNote()], "bookmark")[0]).toMatchObject({
      primary: "麻雀记文档",
      secondary: "https://example.com",
    });
    expect(collectSummary([richNote()], "account")[0]).toMatchObject({
      primary: "GitHub",
      secondary: "liu",
      right: "有密码",
    });
  });

  it("银行卡只露末四位", () => {
    const [row] = collectSummary([richNote()], "bankcard");
    expect(row.primary).toBe("招商银行");
    expect(row.right).toBe("末四位 6789");
  });

  it("坏的 items JSON 不会炸，只是没有条目", () => {
    const broken = note({
      blocks: [blk({ type: "checklist", props: { items: "{not json" } })],
    } as never);
    expect(collectSummary([broken], "checklist")).toEqual([]);
  });
});
