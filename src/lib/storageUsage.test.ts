import { describe, expect, it } from "vitest";
import type { NoteDoc } from "../db/notes";
import {
  EMPTY_USAGE,
  estimateUsage,
  formatBytes,
} from "./storageUsage";
import {
  backupDue,
  backupFileName,
  backupsAvailable,
  parseBackupTime,
  pruneList,
} from "./backups";

const note = (id: string, blocks: unknown[] = []): NoteDoc => ({
  id,
  title: `标题-${id}`,
  date: "2026-10-31",
  createdAt: 1,
  updatedAt: 1,
  blocks: blocks as never,
});

describe("formatBytes", () => {
  it("按 B / KB / MB 换档", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1024 * 1024 * 3)).toBe("3.0 MB");
    expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe("2.0 GB");
  });
});

describe("estimateUsage", () => {
  it("没有笔记时全为 0", async () => {
    expect(await estimateUsage([])).toEqual(EMPTY_USAGE);
  });

  it("统计篇数、正文大小，并把附件字节算进来", async () => {
    // 一张 1x1 的 png data URL（约 70 字节）
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const notes = [
      note("a", [
        { id: "b1", type: "paragraph", props: {}, content: [{ type: "text", text: "你好", styles: {} }], children: [] },
        { id: "b2", type: "image", props: { url: png }, content: undefined, children: [] },
      ]),
      note("b", [{ id: "b3", type: "paragraph", props: {}, content: [], children: [] }]),
    ];
    const usage = await estimateUsage(notes);
    expect(usage.notes).toBe(2);
    expect(usage.assets).toBe(1);
    expect(usage.assetBytes).toBeGreaterThan(50);
    expect(usage.textBytes).toBeGreaterThan(0);
    expect(usage.totalBytes).toBe(usage.assetBytes + usage.textBytes);
  });

  it("同一张图重复出现只算一份（按内容去重）", async () => {
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const block = () => ({ id: `i-${Math.random()}`, type: "image", props: { url: png }, content: undefined, children: [] });
    const usage = await estimateUsage([note("a", [block(), block()])]);
    expect(usage.assets).toBe(1);
  });
});

describe("备份文件名", () => {
  it("带日期时间的稳定命名，能解回时间", () => {
    const now = new Date(2026, 9, 31, 20, 15, 33);
    const name = backupFileName(now);
    expect(name).toBe("sparrow-20261031-201533.sparrow");
    expect(parseBackupTime(name)).toBe(now.getTime());
  });

  it("不是备份文件的名字解析成 null", () => {
    expect(parseBackupTime("backup-before-import-20261031.sparrow")).toBeNull();
    expect(parseBackupTime("notes.db")).toBeNull();
  });
});

describe("backupDue（什么时候该备份）", () => {
  const now = Date.UTC(2026, 9, 31, 12, 0, 0);
  const day = 24 * 3600 * 1000;

  it("从来没备过 → 立刻备份", () => {
    expect(backupDue(null, "daily", now, now - 1000)).toBe(true);
    expect(backupDue(null, "weekly", now, now - 1000)).toBe(true);
  });

  it("每次启动：本次启动之后没备过才备", () => {
    const sessionStart = now - 60_000;
    expect(backupDue(now - 10 * day, "launch", now, sessionStart)).toBe(true);
    expect(backupDue(sessionStart + 1000, "launch", now, sessionStart)).toBe(false);
  });

  it("每天 / 每周按间隔判断", () => {
    expect(backupDue(now - day + 1000, "daily", now, now - 1000)).toBe(false);
    expect(backupDue(now - day, "daily", now, now - 1000)).toBe(true);
    expect(backupDue(now - 2 * day, "weekly", now, now - 1000)).toBe(false);
    expect(backupDue(now - 7 * day, "weekly", now, now - 1000)).toBe(true);
  });
});

describe("pruneList（保留几份）", () => {
  it("按时间新的在前保留，其余要删", () => {
    const names = [
      "sparrow-20261028-090000.sparrow",
      "sparrow-20261030-090000.sparrow",
      "sparrow-20261029-090000.sparrow",
      "backup-before-import-1.sparrow", // 不认识的格式：不参与排序也不删
    ];
    const { keep, drop } = pruneList(names, 2);
    expect(keep).toEqual([
      "sparrow-20261030-090000.sparrow",
      "sparrow-20261029-090000.sparrow",
    ]);
    expect(drop).toEqual(["sparrow-20261028-090000.sparrow"]);
  });

  it("份数下限是 1", () => {
    const names = ["sparrow-20261030-090000.sparrow", "sparrow-20261029-090000.sparrow"];
    expect(pruneList(names, 0).keep).toHaveLength(1);
  });
});

describe("backupsAvailable", () => {
  it("浏览器里不可用", () => {
    expect(backupsAvailable()).toBe(false);
  });
});
