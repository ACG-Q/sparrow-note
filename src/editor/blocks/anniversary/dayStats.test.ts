import { describe, expect, it } from "vitest";
import { dayStats } from "./config";

const today = new Date(2026, 9, 16); // 2026-10-16

describe("dayStats", () => {
  it("无效日期返回 null", () => {
    expect(dayStats("count", "", true, today)).toBeNull();
    expect(dayStats("down", "abc", true, today)).toBeNull();
  });

  it("正计时：从过去某天起算天数", () => {
    const s1 = dayStats("count", "2026-06-10", false, today);
    expect(s1?.num).toBe("第 129 天");
    expect(s1?.tag).toBe("正计时");
    expect(s1?.sub).toBe("始于 2026-06-10");
    const s2 = dayStats("count", "2026-10-16", false, today);
    expect(s2?.num).toBe("第 1 天");
  });

  it("正计时：未来日期显示未开始", () => {
    expect(dayStats("count", "2026-12-01", false, today)?.num).toBe("还未开始");
  });

  it("倒计时：距未来某天", () => {
    const s1 = dayStats("down", "2026-11-08", false, today);
    expect(s1?.num).toBe("还有 23 天");
    expect(s1?.tag).toBe("倒计时");
    expect(s1?.sub).toBe("2026-11-08");
    expect(dayStats("down", "2026-10-16", false, today)?.num).toBe("就是今天");
    expect(dayStats("down", "2026-10-01", false, today)?.num).toBe("已过 15 天");
  });

  it("纪念日：计算下一次日期与周年数", () => {
    const s = dayStats("anniversary", "2025-10-01", true, today);
    expect(s?.tag).toBe("第 1 周年 · 每年");
    expect(s?.sub).toBe("2027-10-01");
    expect(s?.num).toBe("还有 350 天");
  });

  it("纪念日：当天为下一次日期", () => {
    const s = dayStats("anniversary", "2024-10-16", true, today);
    expect(s?.num).toBe("就是今天");
    expect(s?.tag).toBe("第 2 周年 · 每年");
    expect(s?.sub).toBe("2026-10-16");
  });
});
