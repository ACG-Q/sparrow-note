import { describe, expect, it } from "vitest";
import { noteHash, parseNoteHash } from "./nav";

describe("noteHash", () => {
  it("builds a note hash from an id", () => {
    expect(noteHash("abc-123")).toBe("#/note/abc-123");
  });
});

describe("parseNoteHash", () => {
  it("parses a valid note hash", () => {
    expect(parseNoteHash("#/note/abc-123")).toBe("abc-123");
  });

  it("parses uuid ids round-tripped through noteHash", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(parseNoteHash(noteHash(id))).toBe(id);
  });

  it("returns null for empty, incomplete or unrelated hashes", () => {
    expect(parseNoteHash("")).toBeNull();
    expect(parseNoteHash("#/note/")).toBeNull();
    expect(parseNoteHash("#/notes/x")).toBeNull();
    expect(parseNoteHash("#other")).toBeNull();
  });
});
