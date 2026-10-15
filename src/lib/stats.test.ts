import { describe, expect, it } from "vitest";
import type { NoteDoc } from "../db/notes";
import type { AppBlock } from "../editor/schema";
import {
  countByDate,
  dateKey,
  heatmap,
  last7Days,
  moodCountsThisMonth,
  streaks,
  summarize,
} from "./stats";

const NOW = new Date(2026, 9, 14);

function noteOn(date: string, id = `n-${date}`): NoteDoc {
  return { id, title: "标题", date, createdAt: 0, updatedAt: 0, blocks: [] };
}

function moodOn(date: string, emoji: string, id: string): NoteDoc {
  return {
    id,
    title: "心情",
    date,
    createdAt: 0,
    updatedAt: 0,
    blocks: [{ type: "mood", props: { emoji } } as unknown as AppBlock],
  };
}

describe("dateKey", () => {
  it("formats dates as YYYY-MM-DD with zero padding", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dateKey(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("countByDate", () => {
  it("counts notes per date", () => {
    const map = countByDate([noteOn("2026-10-14"), noteOn("2026-10-14", "b"), noteOn("2026-10-13")]);
    expect(map.get("2026-10-14")).toBe(2);
    expect(map.get("2026-10-13")).toBe(1);
  });
});

describe("summarize", () => {
  it("returns zeros when there are no notes", () => {
    expect(summarize([], NOW)).toEqual({ today: 0, week: 0, total: 0 });
  });

  it("counts today, the rolling 7-day window and the total", () => {
    const notes = [
      noteOn("2026-10-14"),
      noteOn("2026-10-14", "b"),
      noteOn("2026-10-08"),
      noteOn("2026-10-07"),
      noteOn("2026-09-30"),
    ];
    expect(summarize(notes, NOW)).toEqual({ today: 2, week: 3, total: 5 });
  });
});

describe("streaks", () => {
  it("returns zeros when there are no notes", () => {
    expect(streaks([], NOW)).toEqual({ current: 0, longest: 0 });
  });

  it("counts consecutive days ending today", () => {
    const notes = [noteOn("2026-10-14"), noteOn("2026-10-13"), noteOn("2026-10-12")];
    expect(streaks(notes, NOW)).toEqual({ current: 3, longest: 3 });
  });

  it("continues the streak from yesterday when today has no note", () => {
    const notes = [noteOn("2026-10-13"), noteOn("2026-10-12")];
    expect(streaks(notes, NOW)).toEqual({ current: 2, longest: 2 });
  });

  it("resets the current streak on a gap", () => {
    const notes = [noteOn("2026-10-14"), noteOn("2026-10-12")];
    expect(streaks(notes, NOW).current).toBe(1);
  });

  it("computes the longest streak across history", () => {
    const notes = [
      noteOn("2026-10-14"),
      noteOn("2026-10-01"),
      noteOn("2026-10-02"),
      noteOn("2026-10-03"),
      noteOn("2026-10-04"),
      noteOn("2026-10-05"),
    ];
    expect(streaks(notes, NOW)).toEqual({ current: 1, longest: 5 });
  });

  it("reports current 0 when the last note is older than yesterday", () => {
    const notes = [noteOn("2026-10-10"), noteOn("2026-10-09")];
    expect(streaks(notes, NOW)).toEqual({ current: 0, longest: 2 });
  });
});

describe("heatmap", () => {
  it("returns 16 weeks of days ending today", () => {
    const cells = heatmap([noteOn("2026-10-14")], 16, NOW);
    expect(cells).toHaveLength(112);
    expect(cells[111]).toEqual({ date: "2026-10-14", count: 1 });
    expect(cells[0].date).toBe(dateKey(new Date(2026, 9, 14 - 111)));
    expect(cells.filter((c) => c.count > 0)).toEqual([{ date: "2026-10-14", count: 1 }]);
  });

  it("supports a custom week count", () => {
    expect(heatmap([], 2, NOW)).toHaveLength(14);
  });
});

describe("last7Days", () => {
  it("returns seven days ascending ending today", () => {
    const cells = last7Days([noteOn("2026-10-14"), noteOn("2026-10-09")], NOW);
    expect(cells).toHaveLength(7);
    expect(cells[0].date).toBe(dateKey(new Date(2026, 9, 14 - 6)));
    expect(cells[6]).toEqual({ date: "2026-10-14", count: 1 });
    expect(cells.find((c) => c.date === "2026-10-09")?.count).toBe(1);
  });
});

describe("moodCountsThisMonth", () => {
  it("counts moods of the current month and sorts descending", () => {
    const notes = [
      moodOn("2026-10-14", "🙂", "m1"),
      moodOn("2026-10-13", "🙂", "m2"),
      moodOn("2026-10-12", "😢", "m3"),
      moodOn("2026-09-30", "🙂", "m4"),
    ];
    expect(moodCountsThisMonth(notes, NOW)).toEqual([
      { emoji: "🙂", count: 2 },
      { emoji: "😢", count: 1 },
    ]);
  });

  it("returns an empty array when there are no moods", () => {
    expect(moodCountsThisMonth([], NOW)).toEqual([]);
  });
});
