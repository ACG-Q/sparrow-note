import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { MAX_PACKAGE_ENTRIES, MAX_UNPACKED_BYTES, readPackage } from "./sparrowPackage";

/**
 * 导入护栏：别人发来的 zip 不能把内存打满。
 *
 * 上限通过 opts.limits 注入成很小的值，测试跑得快也不占内存；
 * 另外单独断言「默认上限就是文档里写的那些数」。
 */
const fileOf = (bytes: Uint8Array) =>
  new File([new Uint8Array(bytes).buffer as ArrayBuffer], "backup.zip", {
    type: "application/zip",
  });

describe("readPackage 的包大小护栏", () => {
  it("默认上限与文档一致（条目 2000 / 解压 200MB）", () => {
    expect(MAX_PACKAGE_ENTRIES).toBe(2000);
    expect(MAX_UNPACKED_BYTES).toBe(200 * 1024 * 1024);
  });

  it("条目数超限时拒绝", async () => {
    const files: Record<string, Uint8Array> = { "format.json": strToU8("{}") };
    for (let i = 0; i < 20; i++) files[`notes/${i}.json`] = strToU8("{}");
    const res = await readPackage(fileOf(zipSync(files)), { limits: { maxEntries: 10 } });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain("太大");
      expect(res.reason).toContain("文件数");
    }
  });

  it("解压后体积超限时拒绝", async () => {
    const big = new Uint8Array(64 * 1024);
    const zip = zipSync({ "format.json": strToU8("{}"), "assets/big.bin": big }, { level: 9 });
    expect(zip.byteLength).toBeLessThan(big.byteLength / 4);

    const res = await readPackage(fileOf(zip), { limits: { maxUnpackedBytes: 32 * 1024 } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("太大");
  });

  it("本体超过上限时直接拒绝（连解压都不做）", async () => {
    const zip = zipSync({ "format.json": strToU8("{}") });
    const res = await readPackage(fileOf(zip), { limits: { maxPackageBytes: 10 } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("备份包超过");
  });

  it("普通坏包（不是 zip）给出明确原因", async () => {
    const res = await readPackage(fileOf(strToU8("这不是 zip")));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("zip");
  });

  it("体积正常但清单缺失时，走原有校验路径而不是大小护栏", async () => {
    const res = await readPackage(fileOf(zipSync({ "notes/a.json": strToU8("{}") })));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toContain("format.json");
      expect(res.reason).not.toContain("太大");
    }
  });
});
