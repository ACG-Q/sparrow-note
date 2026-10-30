import { describe, expect, it, vi } from "vitest";
import type { NoteDoc } from "../db/notes";
import { writeWithRetry } from "./saveGuard";

const note: NoteDoc = {
  id: "n1",
  title: "测试",
  date: "2026-10-30",
  createdAt: 1,
  updatedAt: 1,
  blocks: [],
};

describe("writeWithRetry", () => {
  it("一次成功就返回 ok，不重试", async () => {
    const write = vi.fn(async () => {});
    const res = await writeWithRetry(write, note, { delayMs: 0 });
    expect(res).toEqual({ ok: true, attempts: 1 });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("第一次失败、第二次成功：算成功（瞬时错误自动恢复）", async () => {
    let n = 0;
    const write = vi.fn(async () => {
      n += 1;
      if (n === 1) throw new Error("磁盘忙");
    });
    const res = await writeWithRetry(write, note, { delayMs: 0 });
    expect(res).toEqual({ ok: true, attempts: 2 });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("两次都失败：返回 failed 并带上最后的原因", async () => {
    const write = vi.fn(async () => {
      throw new Error("权限不足");
    });
    const res = await writeWithRetry(write, note, { delayMs: 0 });
    expect(res).toEqual({ ok: false, attempts: 2, reason: "权限不足" });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("非 Error 的抛出也能拿到可读原因", async () => {
    const write = vi.fn(async () => {
      throw "字符串错误";
    });
    const res = await writeWithRetry(write, note, { delayMs: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("字符串错误");
  });

  it("可以只要一次尝试（不重试）", async () => {
    const write = vi.fn(async () => {
      throw new Error("x");
    });
    const res = await writeWithRetry(write, note, { attempts: 1, delayMs: 0 });
    expect(res).toEqual({ ok: false, attempts: 1, reason: "x" });
    expect(write).toHaveBeenCalledTimes(1);
  });
});
