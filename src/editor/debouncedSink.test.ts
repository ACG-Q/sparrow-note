import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncedSink } from "./debouncedSink";

describe("createDebouncedSink", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("停手之后才落盘", () => {
    const made: string[] = [];
    const sink = createDebouncedSink(400, (v: string) => made.push(v));
    sink.push("a");
    expect(made).toEqual([]);
    vi.advanceTimersByTime(399);
    expect(made).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(made).toEqual(["a"]);
  });

  it("连续输入只落盘最后一个", () => {
    const made: string[] = [];
    const sink = createDebouncedSink(400, (v: string) => made.push(v));
    sink.push("a");
    vi.advanceTimersByTime(200);
    sink.push("ab");
    vi.advanceTimersByTime(200);
    sink.push("abc");
    vi.advanceTimersByTime(400);
    expect(made).toEqual(["abc"]);
  });

  it("flush 会把没落盘的值立刻写出去（卸载时的场景）", () => {
    const made: string[] = [];
    const sink = createDebouncedSink(400, (v: string) => made.push(v));
    sink.push("最后一句");
    expect(sink.hasPending()).toBe(true);
    sink.flush();
    expect(made).toEqual(["最后一句"]);
    expect(sink.hasPending()).toBe(false);
    // 再走时间也不会重复写
    vi.advanceTimersByTime(1000);
    expect(made).toEqual(["最后一句"]);
  });

  it("没有待写内容时 flush 什么也不做", () => {
    const made: string[] = [];
    const sink = createDebouncedSink(400, (v: string) => made.push(v));
    sink.flush();
    expect(made).toEqual([]);
  });

  it("flush 之后旧计时器不会再触发一次", () => {
    const made: string[] = [];
    const sink = createDebouncedSink(400, (v: string) => made.push(v));
    sink.push("x");
    sink.flush();
    vi.advanceTimersByTime(2000);
    expect(made).toEqual(["x"]);
  });

  it("cancel 丢弃未写内容", () => {
    const made: string[] = [];
    const sink = createDebouncedSink(400, (v: string) => made.push(v));
    sink.push("不要了");
    sink.cancel();
    vi.advanceTimersByTime(1000);
    expect(made).toEqual([]);
    expect(sink.hasPending()).toBe(false);
  });
});
