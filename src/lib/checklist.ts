import type { NoteDoc } from "../db/notes";

/**
 * 清单（checklist 块）的聚合读取与就地勾选。
 *
 * 清单块的结构：block.type === "checklist"，block.props.items 是 JSON 字符串，
 * 形如 [{ t: "买菜", d: false }]（t = 文本，d = 是否完成）。
 * 这里把「跨笔记」的读取和「改一条」都做成纯函数，方便单测与复用。
 */

export type ChecklistEntry = {
  noteId: string;
  noteTitle: string;
  /** 笔记日期 YYYY-MM-DD */
  noteDate: string;
  /** 清单块的 id：定位到具体一块 */
  blockId: string;
  /** 这一块里的第几条 */
  itemIndex: number;
  text: string;
  done: boolean;
};

type AnyBlock = {
  id?: string;
  type?: string;
  props?: Record<string, unknown>;
  children?: AnyBlock[];
};

/** 深度遍历块树（清单可能嵌在别的块下面） */
function walk(blocks: AnyBlock[] | undefined, visit: (b: AnyBlock) => void) {
  for (const b of blocks ?? []) {
    visit(b);
    if (Array.isArray(b.children) && b.children.length) walk(b.children, visit);
  }
}

export function parseChecklistItems(raw: unknown): { t: string; d: boolean }[] {
  if (typeof raw !== "string") return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is { t: string; d: boolean } =>
          !!x && typeof x === "object" && typeof (x as { t?: unknown }).t === "string",
      )
      .map((x) => ({ t: x.t, d: Boolean((x as { d?: unknown }).d) }));
  } catch {
    return [];
  }
}

/** 把所有笔记里的清单项摊平；空文本的项跳过（编辑中途的空行） */
export function collectChecklist(notes: NoteDoc[]): ChecklistEntry[] {
  const out: ChecklistEntry[] = [];
  for (const note of notes) {
    walk(note.blocks as unknown as AnyBlock[], (b) => {
      if (b.type !== "checklist") return;
      const items = parseChecklistItems(b.props?.items);
      items.forEach((it, i) => {
        const text = it.t.trim();
        if (!text) return;
        out.push({
          noteId: note.id,
          noteTitle: note.title,
          noteDate: note.date,
          blockId: b.id ?? "",
          itemIndex: i,
          text,
          done: it.d,
        });
      });
    });
  }
  return out;
}

/** 未完成 / 已完成 的分组统计 */
export function checklistCounts(entries: ChecklistEntry[]): { open: number; done: number } {
  let open = 0;
  let done = 0;
  for (const e of entries) {
    if (e.done) done += 1;
    else open += 1;
  }
  return { open, done };
}

/**
 * 把某一条清单项翻转/置位，返回新的笔记对象；找不到就返回 null。
 * 纯函数：不改原对象，调用方负责落盘。
 */
export function setChecklistItem(
  note: NoteDoc,
  blockId: string,
  itemIndex: number,
  next: boolean | "toggle" = "toggle",
): NoteDoc | null {
  let changed = false;

  const mapBlocks = (blocks: AnyBlock[]): AnyBlock[] =>
    blocks.map((b) => {
      if (b.type === "checklist" && (b.id ?? "") === blockId) {
        const items = parseChecklistItems(b.props?.items);
        if (!items[itemIndex]) return b;
        const value = next === "toggle" ? !items[itemIndex].d : next;
        if (value === items[itemIndex].d) return b;
        items[itemIndex] = { ...items[itemIndex], d: value };
        changed = true;
        return { ...b, props: { ...b.props, items: JSON.stringify(items) } };
      }
      if (Array.isArray(b.children) && b.children.length) {
        const kids = mapBlocks(b.children);
        if (kids !== b.children) {
          // 只有子块真的变了才换引用
          const anyChanged = kids.some((k, i) => k !== b.children![i]);
          if (anyChanged) return { ...b, children: kids };
        }
      }
      return b;
    });

  const blocks = mapBlocks(note.blocks as unknown as AnyBlock[]);
  if (!changed) return null;
  return { ...note, blocks: blocks as unknown as NoteDoc["blocks"], updatedAt: Date.now() };
}
