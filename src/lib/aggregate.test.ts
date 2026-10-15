import { describe, expect, it } from "vitest";
import type { NoteDoc } from "../db/notes";
import { entriesOnDate, noteMatchesQuery } from "./aggregate";

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
