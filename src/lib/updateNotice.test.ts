import { beforeEach, describe, expect, it } from "vitest";
import {
  clearUpdateNotice,
  getUpdateNotice,
  setUpdateNotice,
  subscribeUpdateNotice,
} from "./updateNotice";

describe("新版本提示 store", () => {
  beforeEach(() => clearUpdateNotice());

  it("启动时还没有提示", () => {
    expect(getUpdateNotice()).toBeNull();
  });

  it("记下版本后能读到完整信息", () => {
    setUpdateNotice({ version: "0.9.0", url: "https://example.com/a.exe", date: "2026-11-01" });
    expect(getUpdateNotice()?.version).toBe("0.9.0");
    expect(getUpdateNotice()?.url).toContain("a.exe");
  });

  it("订阅者收到变化，退订以后不再收到", () => {
    let hits = 0;
    const off = subscribeUpdateNotice(() => {
      hits += 1;
    });
    setUpdateNotice({ version: "0.9.0" });
    expect(hits).toBe(1);
    off();
    setUpdateNotice({ version: "0.9.1" });
    expect(hits).toBe(1);
  });

  it("清空后回到没有提示，再清一次也不广播", () => {
    let hits = 0;
    subscribeUpdateNotice(() => {
      hits += 1;
    });
    setUpdateNotice({ version: "0.9.0" });
    clearUpdateNotice();
    expect(getUpdateNotice()).toBeNull();
    expect(hits).toBe(2);
    clearUpdateNotice();
    expect(hits).toBe(2);
  });
});
