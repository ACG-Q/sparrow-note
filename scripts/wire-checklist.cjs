// 清单页接线：NavView 加 checklist、App 渲染分支、汇总页入口
const fs = require("node:fs");

// ---------- 1. NavView ----------
let nav = fs.readFileSync("src/lib/nav.ts", "utf8");
nav = nav.replace(
  'export type NavView = "timeline" | "summary" | "profile";',
  'export type NavView = "timeline" | "summary" | "profile" | "checklist";',
);
fs.writeFileSync("src/lib/nav.ts", nav, "utf8");

// ---------- 2. App ----------
let app = fs.readFileSync("src/App.tsx", "utf8");

// 2a import
app = app.replace(
  'import { SummaryView } from "./SummaryView";',
  'import { SummaryView } from "./SummaryView";\nimport { ChecklistView } from "./ChecklistView";\nimport { collectChecklist, setChecklistItem, type ChecklistEntry } from "./lib/checklist";',
);

// 2b 渲染分支：summary 之后、profile 之前插 checklist
app = app.replace(
  `    ) : view === "summary" ? (
      <SummaryView
        notes={notes}
        onOpenNote={openNote}
        onOpenMenu={() => setDrawerOpen(true)}
        onOpenPersonalize={() => setProfilePage("personalize")}
      />
    ) : (`,
  `    ) : view === "summary" ? (
      <SummaryView
        notes={notes}
        onOpenNote={openNote}
        onOpenMenu={() => setDrawerOpen(true)}
        onOpenPersonalize={() => setProfilePage("personalize")}
        onOpenChecklist={() => navigate("checklist")}
      />
    ) : view === "checklist" ? (
      <ChecklistView
        notes={notes}
        onToggle={handleToggleChecklist}
        onOpenNote={openNote}
        onBack={() => navigate("summary")}
      />
    ) : (`,
);

// 2c 勾选处理：走和标题/正文一样的保存路径
app = app.replace(
  `  const handleTitleChange = useCallback(`,
  `  /** 清单页里直接勾一项：改完立刻落盘，和正文编辑同一条保存链路 */
  const handleToggleChecklist = useCallback(
    (entry: ChecklistEntry) => {
      const note = notesRef.current.find((n) => n.id === entry.noteId);
      if (!note) return;
      const updated = setChecklistItem(note, entry.blockId, entry.itemIndex);
      if (!updated) return;
      putNote(updated).then(
        () => markSave(true),
        () => markSave(false),
      );
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    },
    [markSave],
  );

  const handleTitleChange = useCallback(`,
);

fs.writeFileSync("src/App.tsx", app, "utf8");

// ---------- 3. 汇总页入口 ----------
let sv = fs.readFileSync("src/SummaryView.tsx", "utf8");
sv = sv.replace(
  `  onOpenMenu,
  onOpenPersonalize,
}: {`,
  `  onOpenMenu,
  onOpenPersonalize,
  onOpenChecklist,
}: {`,
);
sv = sv.replace(
  `  onOpenPersonalize: () => void;
}) {`,
  `  onOpenPersonalize: () => void;
  onOpenChecklist: () => void;
}) {`,
);
// 清单 tab 下，列表上方给一个入口
sv = sv.replace(
  `            <div className={s.list}>`,
  `            {tab === "checklist" && (
              <button type="button" className={s.openChecklist} onClick={onOpenChecklist}>
                全部清单：合在一起勾 →
              </button>
            )}
            <div className={s.list}>`,
);

fs.writeFileSync("src/SummaryView.tsx", sv, "utf8");
console.log("wired");
