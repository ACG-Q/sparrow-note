import { describe, expect, it } from "vitest";
import {
  githubFailureReason,
  normalizeGithubRepo,
  parseGithubRelease,
  type UpdateChannel,
} from "./updates";

/** 造一条 GitHub Release，字段名跟 API 保持一致 */
function release(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tag_name: "v0.2.0",
    body: "修了几个 bug\n\n- 导出的文件名不对",
    html_url: "https://github.com/sparrow-note/sparrow/releases/tag/v0.2.0",
    published_at: "2026-11-01T08:30:00Z",
    draft: false,
    prerelease: false,
    ...over,
  };
}

describe("GitHub Release 解析", () => {
  it("正常 release：tag_name / body / html_url / published_at 各就各位", () => {
    const info = parseGithubRelease(release(), "stable");
    expect(info).not.toBeNull();
    expect(info?.version).toBe("0.2.0");
    expect(info?.notes).toContain("修了几个 bug");
    expect(info?.url).toBe("https://github.com/sparrow-note/sparrow/releases/tag/v0.2.0");
    expect(info?.date).toBe("2026-11-01");
    expect(info?.mandatory).toBe(false);
  });

  it("带 v 前缀的 tag 会去掉前缀", () => {
    expect(parseGithubRelease(release({ tag_name: "v1.2.3" }), "stable")?.version).toBe("1.2.3");
    expect(parseGithubRelease(release({ tag_name: "V2.0.0" }), "stable")?.version).toBe("2.0.0");
    expect(parseGithubRelease(release({ tag_name: " v0.9.0 " }), "stable")?.version).toBe("0.9.0");
    // 预发布后缀要留着，compareVersions 靠它分先后
    expect(parseGithubRelease(release({ tag_name: "v1.0.0-beta.2" }), "stable")?.version).toBe(
      "1.0.0-beta.2",
    );
  });

  it("测试通道从列表里挑第一个 prerelease，没有就取最新那条", () => {
    const list = [
      release({ tag_name: "v1.0.0", prerelease: false }),
      release({ tag_name: "v1.1.0-beta.1", prerelease: true }),
      release({ tag_name: "v1.0.1", prerelease: false }),
    ];
    expect(parseGithubRelease(list, "beta")?.version).toBe("1.1.0-beta.1");

    const stableOnly = [release({ tag_name: "v2.0.0", prerelease: false }), release({ tag_name: "v1.9.0" })];
    expect(parseGithubRelease(stableOnly, "beta")?.version).toBe("2.0.0");
  });

  it("稳定通道不会把 prerelease 当正式版，只有预发布就返回 null", () => {
    const list = [release({ tag_name: "v1.1.0-beta.1", prerelease: true })];
    expect(parseGithubRelease(list, "stable")).toBeNull();
    // 单对象来自 /releases/latest，本身已经是正式版
    expect(parseGithubRelease(release(), "stable")?.version).toBe("0.2.0");
  });

  it("空 body：没有说明就没有 notes，不是空字符串", () => {
    expect(parseGithubRelease(release({ body: "" }), "stable")?.notes).toBeUndefined();
    expect(parseGithubRelease(release({ body: "   \n\t " }), "stable")?.notes).toBeUndefined();
    expect(parseGithubRelease(release({ body: null }), "stable")?.notes).toBeUndefined();
    expect(parseGithubRelease(release({ body: undefined }), "stable")?.notes).toBeUndefined();
  });

  it("说明过长会截断到 2000 字", () => {
    const long = "x".repeat(5000);
    expect(parseGithubRelease(release({ body: long }), "stable")?.notes?.length).toBe(2000);
  });

  it("非法 JSON / 非对象一律判为坏数据", () => {
    for (const bad of [
      null,
      undefined,
      false,
      0,
      "not json",
      "{oops",
      "<html>403</html>",
      [],
      42,
    ]) {
      expect(parseGithubRelease(bad, "stable")).toBeNull();
      expect(parseGithubRelease(bad, "beta")).toBeNull();
    }
    // 数组里全是垃圾也算没有可用数据
    expect(parseGithubRelease([null, 1, "x", []], "beta")).toBeNull();
    // draft 不该被当成新版本
    expect(parseGithubRelease(release({ draft: true }), "stable")).toBeNull();
    expect(parseGithubRelease([release({ draft: true })], "beta")).toBeNull();
  });

  it("缺少 tag_name 或版本号不像样就拒绝", () => {
    expect(parseGithubRelease(release({ tag_name: undefined }), "stable")).toBeNull();
    expect(parseGithubRelease(release({ tag_name: null }), "stable")).toBeNull();
    expect(parseGithubRelease(release({ tag_name: 123 }), "stable")).toBeNull();
    expect(parseGithubRelease(release({ tag_name: "" }), "stable")).toBeNull();
    expect(parseGithubRelease(release({ tag_name: "   " }), "stable")).toBeNull();
    expect(parseGithubRelease(release({ tag_name: "latest" }), "stable")).toBeNull();
    expect(parseGithubRelease(release({ tag_name: "release-2026" }), "stable")).toBeNull();
    // 只有 tag_name 也能用，别的字段只是变空
    const bare = parseGithubRelease({ tag_name: "v3.0.0" }, "stable");
    expect(bare?.version).toBe("3.0.0");
    expect(bare?.notes).toBeUndefined();
    expect(bare?.url).toBeUndefined();
    expect(bare?.date).toBeUndefined();
  });

  it("非 http 的地址和畸形日期不采用", () => {
    expect(parseGithubRelease(release({ html_url: "javascript:alert(1)" }), "stable")?.url).toBeUndefined();
    expect(parseGithubRelease(release({ html_url: "" }), "stable")?.url).toBeUndefined();
    expect(parseGithubRelease(release({ published_at: "昨天" }), "stable")?.date).toBeUndefined();
    expect(parseGithubRelease(release({ published_at: "" }), "stable")?.date).toBeUndefined();
  });

  it("通道参数默认按稳定版处理", () => {
    const channels: UpdateChannel[] = ["stable", "beta"];
    for (const c of channels) {
      expect(parseGithubRelease(release({ tag_name: "v4.5.6" }), c)?.version).toBe("4.5.6");
    }
    expect(parseGithubRelease(release({ tag_name: "v4.5.6" }))?.version).toBe("4.5.6");
  });
});

describe("GitHub 仓库名规整", () => {
  it("owner/repo 直接通过", () => {
    expect(normalizeGithubRepo("sparrow-note/sparrow")).toBe("sparrow-note/sparrow");
    expect(normalizeGithubRepo("  openai/openai-node  ")).toBe("openai/openai-node");
  });

  it("整条仓库地址也能认，顺手去掉 .git 和多余路径", () => {
    expect(normalizeGithubRepo("https://github.com/tauri-apps/tauri")).toBe("tauri-apps/tauri");
    expect(normalizeGithubRepo("https://github.com/tauri-apps/tauri/")).toBe("tauri-apps/tauri");
    expect(normalizeGithubRepo("https://github.com/tauri-apps/tauri.git")).toBe("tauri-apps/tauri");
    expect(normalizeGithubRepo("https://github.com/a/b/releases/latest")).toBe("a/b");
    expect(normalizeGithubRepo("https://github.com/a/b?tab=readme")).toBe("a/b");
  });

  it("认不出来就返回 null，不拿脏字符串拼 URL", () => {
    for (const bad of ["", "   ", "just-a-name", "/", "sparrow", "https://github.com", "a b/c", "a//b"]) {
      expect(normalizeGithubRepo(bad)).toBeNull();
    }
  });
});

describe("GitHub 失败原因", () => {
  it("403 + 额度用尽 → 限流提示", () => {
    expect(githubFailureReason(403, "API rate limit exceeded", "0")).toContain("限流");
    expect(githubFailureReason(403, "API rate limit exceeded for 1.2.3.4")).toContain("限流");
    expect(githubFailureReason(429, "")).toContain("限流");
  });

  it("403 但不是限流 → 如实说拒绝访问", () => {
    const reason = githubFailureReason(403, "Forbidden", "42");
    expect(reason).toContain("403");
    expect(reason).not.toContain("限流");
  });

  it("404 → 提示仓库不存在", () => {
    expect(githubFailureReason(404, "Not Found")).toContain("找不到这个仓库");
  });

  it("其它状态码也有话说", () => {
    expect(githubFailureReason(401, "Bad credentials")).toContain("401");
    expect(githubFailureReason(502, "")).toContain("502");
    expect(githubFailureReason(418, "")).toContain("418");
  });
});
