import { useMemo, useRef, useState } from "react";
import type { NoteDoc } from "./db/notes";
import { clearAllNotes, putNote } from "./db/notes";
import { collectAnniversaries, collectContacts, collectMoods } from "./lib/aggregate";
import { setThemePref, useThemePref, type ThemePref } from "./lib/theme";
import s from "./ProfileView.module.css";

const NAME_KEY = "sparrow-nickname";

function loadName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function ProfileView({
  notes,
  onDataCleared,
}: {
  notes: NoteDoc[];
  onDataCleared: () => void;
}) {
  const [name, setName] = useState(loadName);
  const [saved, setSaved] = useState(false);
  const themePref = useThemePref();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  const stats = useMemo(() => {
    const moods = collectMoods(notes).length;
    const contacts = collectContacts(notes).length;
    const days = collectAnniversaries(notes).length;
    const dates = notes.map((n) => n.date).sort();
    return {
      noteCount: notes.length,
      moodCount: moods,
      contactCount: contacts,
      dayCount: days,
      firstDate: dates[0] ?? "—",
      lastDate: dates[dates.length - 1] ?? "—",
    };
  }, [notes]);

  const saveName = () => {
    localStorage.setItem(NAME_KEY, name.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparrow-note-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("已导出 JSON 文件");
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data: unknown = JSON.parse(String(reader.result));
        if (!Array.isArray(data)) throw new Error("格式错误");
        const ok = data.every(
          (x) =>
            x &&
            typeof x === "object" &&
            typeof (x as NoteDoc).id === "string" &&
            Array.isArray((x as NoteDoc).blocks),
        );
        if (!ok) throw new Error("内容校验失败");
        for (const note of data as NoteDoc[]) {
          await putNote(note);
        }
        onDataCleared();
        setMsg(`已导入 ${data.length} 条笔记`);
      } catch {
        setMsg("导入失败：文件不是有效的备份 JSON");
      }
    };
    reader.readAsText(file);
  };

  const clearAll = async () => {
    if (!window.confirm("确定清空全部笔记？此操作不可撤销。")) return;
    await clearAllNotes();
    onDataCleared();
    setMsg("已清空全部数据");
  };

  return (
    <div className={s.page}>
      <h2 className={s.heading}>我的</h2>

      <section className={s.card}>
        <h3 className={s.cardTitle}>个人信息</h3>
        <div className={s.avatarRow}>
          <div className={s.avatar} aria-hidden="true">
            {name.trim() ? name.trim().slice(0, 1).toUpperCase() : "?"}
          </div>
          <div className={s.nameRow}>
            <input
              className={s.nameInput}
              placeholder="输入昵称"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="button" className={s.btn} onClick={saveName}>
              {saved ? "已保存" : "保存"}
            </button>
          </div>
        </div>
      </section>

      <section className={s.card}>
        <h3 className={s.cardTitle}>统计</h3>
        <div className={s.stats}>
          <div className={s.stat}>
            <span className={s.statNum}>{stats.noteCount}</span>
            <span className={s.statLabel}>笔记</span>
          </div>
          <div className={s.stat}>
            <span className={s.statNum}>{stats.moodCount}</span>
            <span className={s.statLabel}>心情</span>
          </div>
          <div className={s.stat}>
            <span className={s.statNum}>{stats.contactCount}</span>
            <span className={s.statLabel}>联系人</span>
          </div>
          <div className={s.stat}>
            <span className={s.statNum}>{stats.dayCount}</span>
            <span className={s.statLabel}>日子</span>
          </div>
        </div>
        <div className={s.range}>
          记录范围：{stats.firstDate} ~ {stats.lastDate}
        </div>
      </section>

      <section className={s.card}>
        <h3 className={s.cardTitle}>外观</h3>
        <div className={s.themeRow}>
          {(["auto", "light", "dark"] as ThemePref[]).map((p) => (
            <label key={p} className={s.themeLabel}>
              <input
                type="radio"
                name="theme"
                checked={themePref === p}
                onChange={() => setThemePref(p)}
              />
              {p === "auto" ? "跟随系统" : p === "light" ? "浅色" : "深色"}
            </label>
          ))}
        </div>
      </section>

      <section className={s.card}>
        <h3 className={s.cardTitle}>数据</h3>
        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={exportJson}>
            导出 JSON
          </button>
          <button type="button" className={s.btn} onClick={() => fileRef.current?.click()}>
            导入 JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importJson(f);
              e.target.value = "";
            }}
          />
          <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={clearAll}>
            清空全部
          </button>
        </div>
        {msg && <div className={s.msg}>{msg}</div>}
      </section>

      <section className={s.card}>
        <h3 className={s.cardTitle}>关于</h3>
        <div className={s.about}>
          <div>麻雀记 v0.1.0</div>
          <div className={s.aboutSub}>
            本地优先的日记笔记应用，数据仅存储在本机浏览器 IndexedDB 中。
          </div>
        </div>
      </section>
    </div>
  );
}
