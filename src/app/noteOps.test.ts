import { describe, expect, it } from "vitest";
import type { NoteDoc } from "../db/notes";
import { insertIfMissing, nextActiveAfterDelete, patchNote, replaceNote } from "./noteOps";

const note = (id: string, extra: Partial<NoteDoc> = {}): NoteDoc => ({
  id,
  title: "",
  date: "2026-10-29",
  createdAt: 1,
  updatedAt: 1,
  blocks: [],
  ...extra,
});

describe("replaceNote", () => {
  it("替换同 id 的那一条，其余不动", () => {
    const list = [note("a"), note("b")];
    const updated = note("a", { title: "改过" });
    const next = replaceNote(list, updated);
    expect(next[0].title).toBe("改过");
    expect(next[1]).toBe(list[1]);
  });

  it("id 不存在时原样返回（不新增）", () => {
    const list = [note("a")];
    expect(replaceNote(list, note("zzz"))).toHaveLength(1);
  });
});

describe("insertIfMissing", () => {
  it("撤销删除：插到最前面", () => {
    const next = insertIfMissing([note("b")], note("a"));
    expect(next.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("已经有了就不重复插（避免撤销两次出现两条）", () => {
    const list = [note("a"), note("b")];
    expect(insertIfMissing(list, note("a"))).toBe(list);
  });
});

describe("patchNote", () => {
  it("改日期会刷新 updatedAt", () => {
    const next = patchNote(note("a", { date: "2026-10-01" }), { date: "2026-10-02" }, 999);
    expect(next.date).toBe("2026-10-02");
    expect(next.updatedAt).toBe(999);
  });

  it("不改其它字段", () => {
    const base = note("a", { title: "原题" });
    const next = patchNote(base, { date: "2026-11-01" }, 999);
    expect(next.title).toBe("原题");
    expect(next.id).toBe("a");
  });
});

describe("nextActiveAfterDelete", () => {
  it("删的不是当前篇：保持原选择", () => {
    expect(nextActiveAfterDelete([note("a")], "b", "a")).toBe("a");
  });

  it("删的是当前篇：落到剩下的第一篇", () => {
    expect(nextActiveAfterDelete([note("b"), note("c")], "a", "a")).toBe("b");
  });

  it("删空了：返回 null，交给调用方补新篇", () => {
    expect(nextActiveAfterDelete([], "a", "a")).toBeNull();
  });

  it("当前没选中时删别的：仍然是 null", () => {
    expect(nextActiveAfterDelete([note("a")], "b", null)).toBeNull();
  });
});
