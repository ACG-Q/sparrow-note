import { lazy, Suspense, type RefObject } from "react";
import type { NoteDoc } from "../db/notes";
import type { NavView } from "../lib/nav";
import { NoteReader } from "../components/NoteReader";
import { NoteEditor } from "../editor/NoteEditor";
import { SummaryView } from "../SummaryView";
import { ChecklistView } from "../ChecklistView";
import { ProfileView } from "../ProfileView";
import { TimelineView } from "../TimelineView";
import { cnDate, timeOf, bodyText, dateShort } from "../lib/timeline";
import type { ChecklistEntry } from "../lib/checklist";
import s from "../App.module.css";

const SettingsView = lazy(() =>
  import("../SettingsView").then((m) => ({ default: m.SettingsView })),
);
const PersonalizeView = lazy(() =>
  import("../PersonalizeView").then((m) => ({ default: m.PersonalizeView })),
);
const PermissionsView = lazy(() =>
  import("../PermissionsView").then((m) => ({ default: m.PermissionsView })),
);
const AboutView = lazy(() => import("../AboutView").then((m) => ({ default: m.AboutView })));

type ProfilePage = "settings" | "personalize" | "permissions" | "about" | null;

export type MainPaneProps = {
  active: NoteDoc | null;
  view: NavView;
  isNarrow: boolean;
  readMode: boolean;
  saveState: "idle" | "ok" | "err";
  shareHint: string | null;
  noteNumber: number;
  prevNote: NoteDoc | null;
  nextNote: NoteDoc | null;
  listOn: boolean;
  recent: NoteDoc[];
  visibleNotes: NoteDoc[];
  query: string;
  dateFilter: string;
  profilePage: ProfilePage;
  dark: boolean;
  dateInputRef: RefObject<HTMLInputElement | null>;
  onOpenDatePicker: () => void;
  onUpdateNote: (patch: Partial<Pick<NoteDoc, "date" | "title">>, markSave: (ok: boolean) => void) => void;
  markSave: (ok: boolean) => void;
  onTitleChange: (title: string) => void;
  onBlocksChange: (blocks: NoteDoc["blocks"]) => void;
  onOpenNote: (id: string) => void;
  onCreate: () => void;
  onToggleList: (v: boolean) => void;
  onQueryChange: (q: string) => void;
  onDateChange: (d: string) => void;
  onOpenDrawer: () => void;
  onProfilePage: (p: ProfilePage) => void;
  onNavigate: (v: NavView) => void;
  onToggleChecklist: (entry: ChecklistEntry) => void;
  onDataCleared: () => void;
  onToggleTheme: () => void;
};

/** 主内容区：编辑器 / 空态 / 四种视图页 */
export function MainPane(props: MainPaneProps) {
  const {
    active,
    view,
    isNarrow,
    readMode,
    saveState,
    shareHint,
    noteNumber,
    prevNote,
    nextNote,
    listOn,
    recent,
    visibleNotes,
    query,
    dateFilter,
    profilePage,
    dark,
    dateInputRef,
    onOpenDatePicker,
    onUpdateNote,
    markSave,
    onTitleChange,
    onBlocksChange,
    onOpenNote,
    onCreate,
    onToggleList,
    onQueryChange,
    onDateChange,
    onOpenDrawer,
    onProfilePage,
    onNavigate,
    onDataCleared,
    onToggleTheme,
    onToggleChecklist,
  } = props;

  const editor = active && (
    <div className={s.editorPage} key={active.id}>
      <div className={s.dateline}>
        {readMode ? (
          <span className={s.dateText}>{cnDate(active.date)}</span>
        ) : (
          <span className={s.dateField}>
            <button type="button" className={s.dateBtn} onClick={onOpenDatePicker}>
              {cnDate(active.date)}
            </button>
            <span className={s.dateIcon} aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="2.5" y="3.5" width="11" height="10" />
                <line x1="2.5" y1="6.5" x2="13.5" y2="6.5" />
                <line x1="5.5" y1="2" x2="5.5" y2="4.5" />
                <line x1="10.5" y1="2" x2="10.5" y2="4.5" />
              </svg>
            </span>
            <input
              ref={dateInputRef}
              className={s.dateProxy}
              type="date"
              value={active.date}
              aria-label="日期"
              tabIndex={-1}
              onChange={(e) => onUpdateNote({ date: e.target.value }, markSave)}
            />
          </span>
        )}
        <span className={s.timeText}>{timeOf(active)}</span>
        <span className={s.grow} />
        {shareHint && <span className={s.shareHint}>{shareHint}</span>}
        {!readMode && saveState !== "idle" && (
          <span className={saveState === "ok" ? s.saveMark : `${s.saveMark} ${s.saveErr}`}>
            {saveState === "ok" ? "已保存" : "保存失败"}
          </span>
        )}
        <span>第 {noteNumber} 篇</span>
      </div>

      {readMode ? (
        <NoteReader note={active} />
      ) : (
        <>
          <input
            className={s.titleInput}
            placeholder="无标题"
            value={active.title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
          <NoteEditor initialContent={active.blocks} onChange={onBlocksChange} />
        </>
      )}

      {!isNarrow && (
        <div className={s.docFoot}>
          <button
            type="button"
            className={s.footBtn}
            disabled={!prevNote}
            onClick={() => prevNote && onOpenNote(prevNote.id)}
          >
            <span className={s.arw}>←</span>上一篇
            {prevNote ? ` · ${prevNote.title || "无标题"}` : ""}
          </button>
          <button
            type="button"
            className={`${s.footBtn} ${s.footNext}`}
            disabled={!nextNote}
            onClick={() => nextNote && onOpenNote(nextNote.id)}
          >
            下一篇{nextNote ? ` · ${nextNote.title || "无标题"}` : ""}
            <span className={s.arw}>→</span>
          </button>
        </div>
      )}
    </div>
  );

  const readerEmpty = (
    <div className={listOn ? s.readerEmpty : `${s.readerEmpty} ${s.emptyWithList}`}>
      <span className={s.emptySeal} aria-hidden="true">
        雀
      </span>
      <p className={s.emptyTitle}>{listOn ? "从目录里选一篇" : "目录收起来了"}</p>
      <p className={s.emptySub}>
        {listOn ? "左边是这一期的目录。" : "最近几篇列在下面，也可以把目录打开。"}
      </p>
      <div className={s.emptyActions}>
        <button className={s.emptyBtn} onClick={onCreate}>
          写一条
        </button>
        {!listOn && (
          <button className={s.emptyBtn} onClick={() => onToggleList(true)}>
            打开目录
          </button>
        )}
      </div>

      {recent.length > 0 && (
        <div className={s.recent}>
          <p className={s.recentLabel}>最近 {recent.length} 篇</p>
          <ul className={s.recentList}>
            {recent.map((n) => (
              <li key={n.id}>
                <button type="button" className={s.recentItem} onClick={() => onOpenNote(n.id)}>
                  <span className={s.recentDate}>{dateShort(n.date)}</span>
                  <span className={s.recentText}>
                    <span className={s.recentTitle}>{n.title || "无标题"}</span>
                    <span className={s.recentExcerpt}>{bodyText(n)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <Suspense fallback={<div className={s.loading}>…</div>}>
      {profilePage === "settings" ? (
        <SettingsView notes={visibleNotes} onDataCleared={onDataCleared} onBack={() => onProfilePage(null)} />
      ) : profilePage === "personalize" ? (
        <PersonalizeView onBack={() => onProfilePage(null)} />
      ) : profilePage === "permissions" ? (
        <PermissionsView onBack={() => onProfilePage(null)} />
      ) : profilePage === "about" ? (
        <AboutView onBack={() => onProfilePage(null)} />
      ) : active ? (
        editor
      ) : view === "timeline" ? (
        isNarrow ? (
          <TimelineView
            notes={visibleNotes}
            onOpenNote={onOpenNote}
            onCreate={onCreate}
            onOpenMenu={onOpenDrawer}
            dark={dark}
            onToggleTheme={onToggleTheme}
            query={query}
            onClearQuery={() => onQueryChange("")}
            dateFilter={dateFilter}
            onClearDate={() => onDateChange("")}
          />
        ) : (
          readerEmpty
        )
      ) : view === "summary" ? (
        <SummaryView
          notes={visibleNotes}
          onOpenNote={onOpenNote}
          onOpenMenu={onOpenDrawer}
          onOpenPersonalize={() => onProfilePage("personalize")}
          onOpenChecklist={() => onNavigate("checklist")}
        />
      ) : view === "checklist" ? (
        <ChecklistView
          notes={visibleNotes}
          onToggle={onToggleChecklist}
          onOpenNote={onOpenNote}
          onBack={() => onNavigate("summary")}
        />
      ) : (
        <ProfileView
          notes={visibleNotes}
          onOpenSettings={() => onProfilePage("settings")}
          onOpenPersonalize={() => onProfilePage("personalize")}
          onOpenPermissions={() => onProfilePage("permissions")}
          onOpenAbout={() => onProfilePage("about")}
          onOpenMenu={onOpenDrawer}
        />
      )}
    </Suspense>
  );
}
