import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EDIT_CONTAINER_BY_TYPE } from "./_shared/editMode";

const blocksDir = fileURLToPath(new URL(".", import.meta.url));

function sourceOf(rel: string): string {
  return readFileSync(join(blocksDir, rel), "utf-8");
}

function blockDirs(): string[] {
  return readdirSync(blocksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.includes("."))
    .map((d) => d.name);
}

describe("自定义块外壳守卫", () => {
  it("所有块目录不再出现「点击编辑」角标文案", () => {
    for (const dir of blockDirs()) {
      for (const file of ["index.tsx", "Display.tsx", "Edit.tsx"]) {
        const path = join(blocksDir, dir, file);
        if (!existsSync(path)) continue;
        const src = readFileSync(path, "utf-8");
        expect(src, `${dir}/${file} 不应包含「点击编辑」`).not.toContain("点击编辑");
      }
    }
  });

  it("BlockShell 不再导出 DisplayWrap", () => {
    expect(sourceOf("_shared/BlockShell.tsx")).not.toContain("export function DisplayWrap");
  });

  it("blockCommon 不再含旧边框容器与角标样式", () => {
    const css = sourceOf("_shared/blockCommon.module.css");
    expect(css).not.toContain(".editHint");
    expect(css).not.toMatch(/\.display\s*\{[^}]*border:/);
  });

  it("editMode 覆盖全部块目录（无遗漏新块）", () => {
    expect(blockDirs().sort()).toEqual(Object.keys(EDIT_CONTAINER_BY_TYPE).sort());
  });

  it("八个 side/modal 块均已注册面板表单", () => {
    const registry = sourceOf("_shared/editForms.tsx");
    for (const type of ["contact", "anniversary", "location", "account", "bookmark", "bankcard", "drawing", "voice"]) {
      expect(registry, `editForms 缺少 ${type} 注册`).toContain(`${type}: (`);
    }
  });

  it("NoteEditor 挂载了编辑宿主", () => {
    const noteEditor = readFileSync(join(blocksDir, "..", "NoteEditor.tsx"), "utf-8");
    expect(noteEditor).toContain("<EditHost />");
    expect(noteEditor).toContain("BlockEditProvider");
  });
});
