import { describe, expect, it } from "vitest";
import { compareVersions } from "./appInfo";
import { parseManifest, shouldAutoCheck } from "./updates";

describe("版本比较", () => {
  it("主次修订依次比较", () => {
    expect(compareVersions("0.2.0", "0.1.9")).toBe(1);
    expect(compareVersions("1.0.0", "0.99.99")).toBe(1);
    expect(compareVersions("0.1.0", "0.1.0")).toBe(0);
    expect(compareVersions("0.1.0", "0.1.1")).toBe(-1);
  });

  it("允许 v 前缀和缺位补零", () => {
    expect(compareVersions("v1.2", "1.2.0")).toBe(0);
    expect(compareVersions("v1.2.1", "1.2")).toBe(1);
  });

  it("正式版高于同号预发布版", () => {
    expect(compareVersions("1.0.0", "1.0.0-beta")).toBe(1);
    expect(compareVersions("1.0.0-beta", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.1")).toBe(1);
  });
});

describe("更新清单解析", () => {
  it("正常清单", () => {
    const info = parseManifest({
      version: "0.2.0",
      notes: "修了几个 bug",
      url: "https://example.com/sparrow-0.2.0.exe",
      date: "2026-11-01",
      mandatory: true,
    });
    expect(info?.version).toBe("0.2.0");
    expect(info?.url).toContain("sparrow-0.2.0.exe");
    expect(info?.mandatory).toBe(true);
  });

  it("版本号不合法就拒绝", () => {
    expect(parseManifest({ version: "latest" })).toBeNull();
    expect(parseManifest({ version: "" })).toBeNull();
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest("0.2.0")).toBeNull();
  });

  it("非 http 链接不采用", () => {
    expect(parseManifest({ version: "0.2.0", url: "javascript:alert(1)" })?.url).toBeUndefined();
    expect(parseManifest({ version: "0.2.0", url: "file:///etc/passwd" })?.url).toBeUndefined();
  });

  it("说明过长会截断", () => {
    const long = "x".repeat(5000);
    expect(parseManifest({ version: "0.2.0", notes: long })?.notes?.length).toBe(2000);
  });
});

describe("启动时要不要自动检查", () => {
  // autoCheck 开关 × 是否配置更新地址，四种组合都要说清楚
  const cases: { autoCheck: boolean; endpoint: string; want: boolean; why: string }[] = [
    { autoCheck: true, endpoint: "https://example.com/sparrow/latest.json", want: true, why: "开了开关又填了地址才检查" },
    { autoCheck: true, endpoint: "", want: false, why: "开了开关但没地址：不该发请求" },
    { autoCheck: false, endpoint: "https://example.com/sparrow/latest.json", want: false, why: "地址填了但开关是关的" },
    { autoCheck: false, endpoint: "", want: false, why: "两样都没有" },
  ];

  for (const c of cases) {
    it(`autoCheck=${c.autoCheck} · endpoint=${c.endpoint ? "有" : "无"} → ${c.want}（${c.why}）`, () => {
      expect(shouldAutoCheck({ autoCheck: c.autoCheck, endpoint: c.endpoint })).toBe(c.want);
    });
  }

  it("只有空白的地址等于没配", () => {
    expect(shouldAutoCheck({ autoCheck: true, endpoint: "   " })).toBe(false);
    expect(shouldAutoCheck({ autoCheck: true, endpoint: "\n\t " })).toBe(false);
    expect(shouldAutoCheck({ autoCheck: true, endpoint: " https://example.com/a.json " })).toBe(true);
  });

  it("autoCheck 只认布尔真值，缺字段按关处理", () => {
    const loose = { autoCheck: undefined, endpoint: "https://example.com/a.json" } as unknown as {
      autoCheck: boolean;
      endpoint: string;
    };
    expect(shouldAutoCheck(loose)).toBe(false);
  });
});
