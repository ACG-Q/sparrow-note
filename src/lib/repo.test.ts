import { describe, expect, it } from "vitest";
import { DEFAULT_GITHUB_REPO, parseRepo, repoFromPackageJson } from "./repo";

describe("parseRepo", () => {
  it("认 owner/repo 本身", () => {
    expect(parseRepo("sparrow-note/sparrow")).toBe("sparrow-note/sparrow");
  });

  it("认各种 GitHub 地址写法", () => {
    const cases = [
      "https://github.com/sparrow-note/sparrow",
      "https://github.com/sparrow-note/sparrow.git",
      "https://github.com/sparrow-note/sparrow/",
      "https://github.com/sparrow-note/sparrow/issues",
      "git+https://github.com/sparrow-note/sparrow.git",
      "git://github.com/sparrow-note/sparrow.git",
      "github:sparrow-note/sparrow",
      "http://www.github.com/sparrow-note/sparrow",
      "https://github.com/sparrow-note/sparrow?tab=readme",
    ];
    for (const raw of cases) {
      expect(parseRepo(raw), raw).toBe("sparrow-note/sparrow");
    }
  });

  it("不是 GitHub 仓库就返回 null", () => {
    for (const raw of ["", "   ", "sparrow", "https://gitlab.com/a/b", "https://github.com/only-owner"]) {
      expect(parseRepo(raw), raw).toBeNull();
    }
  });

  it("非法字符挡住", () => {
    expect(parseRepo("bad owner/repo")).toBeNull();
    expect(parseRepo("owner/re po")).toBeNull();
  });
});

describe("repoFromPackageJson", () => {
  it("对象写法取 url", () => {
    expect(repoFromPackageJson({ type: "git", url: "git+https://github.com/a/b.git" })).toBe("a/b");
  });

  it("字符串写法直接解析", () => {
    expect(repoFromPackageJson("github:o/r")).toBe("o/r");
    expect(repoFromPackageJson("https://github.com/o/r")).toBe("o/r");
  });

  it("缺字段时返回 null，不炸", () => {
    expect(repoFromPackageJson(undefined)).toBeNull();
    expect(repoFromPackageJson({})).toBeNull();
    expect(repoFromPackageJson({ url: 42 })).toBeNull();
  });
});

describe("默认仓库", () => {
  it("来自 package.json 的 repository，能直接喂给更新检查", () => {
    // 仓库名变了只改 package.json；这里只要求「形如 owner/repo」
    expect(DEFAULT_GITHUB_REPO).toMatch(/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/);
  });
});

  it("认 SSH 写法（package.json 里常写这种）", () => {
    for (const raw of [
      "git+ssh://git@github.com/ACG-Q/sparrow-note.git",
      "ssh://git@github.com/ACG-Q/sparrow-note.git",
      "git@github.com:ACG-Q/sparrow-note.git",
    ]) {
      expect(parseRepo(raw), raw).toBe("ACG-Q/sparrow-note");
    }
  });
