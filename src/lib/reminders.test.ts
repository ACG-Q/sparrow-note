import { describe, expect, it } from "vitest";
import { dueReminders, nextOccurrence, reminderText } from "./reminders";

const TODAY = new Date("2026-10-26T10:00:00");

function noteWith(blocks: unknown[], id = "n1", title = "测试笔记") {
  return { id, title, date: "2026-10-26", blocks };
}

function anniversary(props: Record<string, unknown>, id = "b1") {
  return { id, type: "anniversary", props: { kind: "anniversary", annual: true, ...props } };
}

describe("纪念日提醒", () => {
  it("每年重复：今年的日子还没过就用今年", () => {
    const next = nextOccurrence("1990-12-25", true, TODAY);
    expect(next?.getFullYear()).toBe(2026);
    expect(next?.getMonth()).toBe(11);
  });

  it("每年重复：今年已过就顺延到明年", () => {
    const next = nextOccurrence("1990-03-01", true, TODAY);
    expect(next?.getFullYear()).toBe(2027);
  });

  it("当天到期会命中，并给出 days = 0", () => {
    const hits = dueReminders([noteWith([anniversary({ date: "2026-10-26", remind: "on" })])], {
      today: TODAY,
      withinDays: 0,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].days).toBe(0);
    expect(hits[0].title).toBe("测试笔记");
  });

  it("没开提醒的块不参与", () => {
    const hits = dueReminders([noteWith([anniversary({ date: "2026-10-26" })])], {
      today: TODAY,
      withinDays: 3,
    });
    expect(hits).toHaveLength(0);
  });

  it("正计时（count）不提醒", () => {
    const hits = dueReminders(
      [noteWith([anniversary({ date: "2026-10-26", remind: "on", kind: "count" })])],
      { today: TODAY, withinDays: 3 },
    );
    expect(hits).toHaveLength(0);
  });

  it("按块自己的提前天数过滤", () => {
    const soon = noteWith([anniversary({ date: "2026-10-28", remind: "on", remindDays: "3" })], "n2");
    const later = noteWith([anniversary({ date: "2026-11-05", remind: "on", remindDays: "3" })], "n3");
    const hits = dueReminders([soon, later], { today: TODAY });
    expect(hits.map((h) => h.noteId)).toEqual(["n2"]);
  });

  it("同一天多条按剩余天数排序", () => {
    const hits = dueReminders(
      [
        noteWith([anniversary({ date: "2026-10-30", remind: "on", remindDays: "7" })], "n5"),
        noteWith([anniversary({ date: "2026-10-27", remind: "on", remindDays: "7" })], "n6"),
      ],
      { today: TODAY },
    );
    expect(hits.map((h) => h.days)).toEqual([1, 4]);
  });

  it("文案区分今天和还有几天", () => {
    const today = dueReminders([noteWith([anniversary({ date: "2026-10-26", remind: "on" })])], {
      today: TODAY,
    })[0];
    expect(reminderText(today).title).toContain("就是今天");

    const later = dueReminders(
      [noteWith([anniversary({ date: "2026-10-29", remind: "on", remindDays: "5" })], "n7")],
      { today: TODAY },
    )[0];
    expect(reminderText(later).title).toContain("还有 3 天");
  });

  it("重复运行不会产生不同去重键", () => {
    const note = noteWith([anniversary({ date: "2026-10-26", remind: "on" })]);
    const a = dueReminders([note], { today: TODAY })[0];
    const b = dueReminders([note], { today: new Date("2026-10-26T18:00:00") })[0];
    expect(a.key).toBe(b.key);
  });
});
