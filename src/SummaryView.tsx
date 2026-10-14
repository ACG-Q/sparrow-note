import { useMemo, useState } from "react";
import type { NoteDoc } from "./db/notes";
import {
  collectAnniversaries,
  collectContacts,
  collectMoods,
  daysUntil,
} from "./lib/aggregate";
import s from "./SummaryView.module.css";

type Tab = "mood" | "contact" | "anniversary";

export function SummaryView({
  notes,
  onOpenNote,
}: {
  notes: NoteDoc[];
  onOpenNote: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("mood");
  const moods = useMemo(() => collectMoods(notes), [notes]);
  const contacts = useMemo(() => collectContacts(notes), [notes]);
  const anniversaries = useMemo(() => collectAnniversaries(notes), [notes]);

  return (
    <div className={s.page}>
      <h1 className={s.title}>汇总</h1>
      <div className={s.tabs}>
        <button className={tab === "mood" ? `${s.tab} ${s.tabActive}` : s.tab} onClick={() => setTab("mood")}>
          心情回顾 <span className={s.tabCount}>{moods.length}</span>
        </button>
        <button
          className={tab === "contact" ? `${s.tab} ${s.tabActive}` : s.tab}
          onClick={() => setTab("contact")}
        >
          联系人 <span className={s.tabCount}>{contacts.length}</span>
        </button>
        <button
          className={tab === "anniversary" ? `${s.tab} ${s.tabActive}` : s.tab}
          onClick={() => setTab("anniversary")}
        >
          纪念日 <span className={s.tabCount}>{anniversaries.length}</span>
        </button>
      </div>

      {tab === "mood" && (
        <div className={s.list}>
          {moods.length === 0 && (
            <div className={s.empty}>还没有心情记录，在笔记中插入「心情」块试试</div>
          )}
          {moods.map((m, i) => (
            <div key={i} className={s.row} onClick={() => onOpenNote(m.noteId)}>
              <span className={s.moodEmoji}>{m.emoji}</span>
              <div className={s.moodBody}>
                <div className={s.moodText}>{m.text || "（无备注）"}</div>
                <div className={s.meta}>
                  {m.noteDate}
                  {m.noteTitle ? ` · ${m.noteTitle}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "contact" && (
        <div className={s.list}>
          {contacts.length === 0 && (
            <div className={s.empty}>还没有联系人，在笔记中插入「联系人」块试试</div>
          )}
          {contacts.map((c, i) => (
            <div key={i} className={`${s.row} ${s.contactRow}`} onClick={() => onOpenNote(c.noteId)}>
              <div className={s.contactName}>
                {c.name || "（无名）"}
                {c.relation && <span className={s.contactRelation}>{c.relation}</span>}
              </div>
              <div className={s.contactPhone}>{c.phone}</div>
              <div className={s.meta}>{c.noteDate}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "anniversary" && (
        <div className={s.list}>
          {anniversaries.length === 0 && (
            <div className={s.empty}>还没有纪念日，在笔记中插入「纪念日」块试试</div>
          )}
          {anniversaries.map((a, i) => {
            const days = daysUntil(a.date);
            return (
              <div
                key={i}
                className={`${s.row} ${s.anniversaryRow}`}
                onClick={() => onOpenNote(a.noteId)}
              >
                <div className={s.anniversaryBody}>
                  <div className={s.anniversaryName}>{a.title}</div>
                  <div className={s.anniversaryDate}>{a.date}</div>
                </div>
                {days !== null && (
                  <span className={days <= 7 ? `${s.countdown} ${s.urgent}` : s.countdown}>
                    {days > 0 ? `还有 ${days} 天` : days === 0 ? "就是今天" : `已过 ${-days} 天`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
