import { useEffect } from "react";
import { listNotes, type NoteDoc } from "../db/notes";
import { useSettings } from "./settings";
import { notify } from "./notify";
import { dueReminders, reminderText } from "./reminders";

const SENT_KEY = "sparrow-reminders-sent";

type SentMap = Record<string, string>;

function loadSent(): SentMap {
  try {
    const raw = localStorage.getItem(SENT_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as SentMap) : {};
  } catch {
    return {};
  }
}

function saveSent(map: SentMap): void {
  try {
    // 只留最近 400 条，别让 localStorage 无限长
    const entries = Object.entries(map).slice(-400);
    localStorage.setItem(SENT_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* 存不下就算了，下次最多重复提醒一次 */
  }
}

/**
 * 纪念日提醒：每分钟检查一次，到了设定时间就把「今天/未来 N 天」到期的纪念日推出去。
 * 同一条（笔记+块+事件日期）每天只提醒一次。
 */
export function useAnniversaryReminders(): void {
  const settings = useSettings();

  useEffect(() => {
    if (!settings.reminderEnabled) return;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (now.getHours() < settings.reminderHour) return;

      let notes: NoteDoc[];
      try {
        notes = await listNotes();
      } catch {
        return;
      }

      const hits = dueReminders(
        notes.map((n) => ({ id: n.id, title: n.title, date: n.date, blocks: n.blocks })),
        { today: now, withinDays: settings.reminderWithinDays },
      );
      if (!hits.length) return;

      const sent = loadSent();
      const fresh = hits.filter((hit) => sent[`${hit.key}:${today}`] !== today);
      if (!fresh.length) return;

      let changed = false;
      for (const hit of fresh) {
        const text = reminderText(hit);
        const ok = await notify(text.title, text.body);
        if (!ok) continue;
        sent[`${hit.key}:${today}`] = today;
        changed = true;
      }
      if (changed) saveSent(sent);
    };

    void tick();
    const id = window.setInterval(() => void tick(), 60_000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [settings.reminderEnabled, settings.reminderHour, settings.reminderWithinDays]);
}
