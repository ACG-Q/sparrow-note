import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const noteEditorPath = fileURLToPath(new URL("./NoteEditor.tsx", import.meta.url));

describe("NoteEditor 根因守卫", () => {
  it("不向 BlockNoteView 传与 contenteditable 冲突的 bn-editor 类名", () => {
    const source = readFileSync(noteEditorPath, "utf-8");
    expect(source).not.toContain('className="bn-editor"');
    expect(source).not.toContain("className={`bn-editor");
  });
});
