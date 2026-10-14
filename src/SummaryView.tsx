import { useMemo, useState } from "react";
import type { NoteDoc } from "./db/notes";
import {
  collectAnniversaries,
  collectContacts,
  collectMoods,
  daysUntil,
} from "./lib/aggregate";

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
    <div className="summary-page">
      <h1 className="summary-title">汇总</h1>
      <div className="summary-tabs">
        <button
          className={tab === "mood" ? "tab active" : "tab"}
          onClick={() => setTab("mood")}
        >
          心情回顾 <span className="tab-count">{moods.length}</span>
        </button>
        <button
          className={tab === "contact" ? "tab active" : "tab"}
          onClick={() => setTab("contact")}
        >
          联系人 <span className="tab-count">{contacts.length}</span>
        </button>
        <button
          className={tab === "anniversary" ? "tab active" : "tab"}
          onClick={() => setTab("anniversary")}
        >
          纪念日 <span className="tab-count">{anniversaries.length}</span>
        </button>
      </div>

      {tab === "mood" && (
        <div className="summary-list">
          {moods.length === 0 && <div className="summary-empty">还没有心情记录，在笔记中插入「心情」块试试</div>}
          {moods.map((m, i) => (
            <div
              key={i}
              className="summary-row mood-row"
              onClick={() => onOpenNote(m.noteId)}
            >
              <span className="mood-emoji">{m.emoji}</span>
              <div className="mood-body">
                <div className="mood-text">{m.text || "（无备注）"}</div>
                <div className="mood-meta">
                  {m.noteDate}
                  {m.noteTitle ? ` · ${m.noteTitle}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "contact" && (
        <div className="summary-list">
          {contacts.length === 0 && <div className="summary-empty">还没有联系人，在笔记中插入「联系人」块试试</div>}
          {contacts.map((c, i) => (
            <div
              key={i}
              className="summary-row contact-row"
              onClick={() => onOpenNote(c.noteId)}
            >
              <div className="contact-name">
                {c.name || "（无名）"}
                {c.relation && <span className="contact-relation">{c.relation}</span>}
              </div>
              <div className="contact-phone">{c.phone}</div>
              <div className="contact-meta">{c.noteDate}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "anniversary" && (
        <div className="summary-list">
          {anniversaries.length === 0 && <div className="summary-empty">还没有纪念日，在笔记中插入「纪念日」块试试</div>}
          {anniversaries.map((a, i) => {
            const days = daysUntil(a.date);
            return (
              <div
                key={i}
                className="summary-row anniversary-row"
                onClick={() => onOpenNote(a.noteId)}
              >
                <div className="anniversary-body">
                  <div className="anniversary-name">{a.title}</div>
                  <div className="anniversary-date">{a.date}</div>
                </div>
                {days !== null && (
                  <span className={days <= 7 ? "bn-countdown urgent" : "bn-countdown"}>
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
