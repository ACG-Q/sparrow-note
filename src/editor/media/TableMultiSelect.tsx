import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { isTableContent, mergeTableContents, withHeaders, type TableContent } from "./tableMerge";
import s from "./TableMultiSelect.module.css";

/**
 * 表格多选。
 * BlockNote 没有块级多选，这里用应用层状态：进入多选后点表格块即勾选，
 * 底部浮条做批量操作（合并表格 / 表头行 / 表头列）。
 */

type State = { active: boolean; ids: string[] };

let state: State = { active: false, ids: [] };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(next: State) {
  state = next;
  emit();
}

export function enterMultiSelect(ids: string[] = []) {
  set({ active: true, ids });
}

export function exitMultiSelect() {
  set({ active: false, ids: [] });
}

export function toggleTable(id: string) {
  const has = state.ids.includes(id);
  set({ ...state, ids: has ? state.ids.filter((x) => x !== id) : [...state.ids, id] });
}

export function useMultiSelect(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

type EditorLike = {
  document: unknown[];
  getBlock: (id: string) => unknown;
};

function blockContent(editor: EditorLike, id: string): TableContent | null {
  const block = editor.getBlock(id) as { content?: unknown } | undefined;
  return block && isTableContent(block.content) ? block.content : null;
}

function callUpdate(editor: unknown, block: unknown, update: unknown) {
  const fn = (editor as { updateBlock?: (b: unknown, u: unknown) => void }).updateBlock;
  fn?.call(editor, block, update);
}

function callRemove(editor: unknown, blocks: unknown[]) {
  const fn = (editor as { removeBlocks?: (b: unknown[]) => void }).removeBlocks;
  fn?.call(editor, blocks);
}

/** 把选中的表格按文档顺序合并到第一张里 */
export function mergeSelectedTables(editor: EditorLike, ids: string[]): { ok: boolean; merged: number } {
  const doc = editor.document as { id: string }[];
  const order = new Map(doc.map((b, i) => [b.id, i]));
  const sorted = [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const contents: TableContent[] = [];
  const kept: string[] = [];
  for (const id of sorted) {
    const c = blockContent(editor, id);
    if (c) {
      contents.push(c);
      kept.push(id);
    }
  }
  if (contents.length < 2) return { ok: false, merged: 0 };

  const [firstId, ...rest] = kept;
  callUpdate(editor, editor.getBlock(firstId), { content: mergeTableContents(contents) });
  callRemove(editor, rest.map((id) => editor.getBlock(id)));
  return { ok: true, merged: contents.length };
}

/** 批量设置表头行/列 */
export function applyHeadersToSelected(
  editor: EditorLike,
  ids: string[],
  kind: "headerRows" | "headerCols",
  value: number | undefined,
): boolean {
  let touched = 0;
  for (const id of ids) {
    const content = blockContent(editor, id);
    if (!content) continue;
    callUpdate(editor, editor.getBlock(id), { content: withHeaders(content, { [kind]: value }) });
    touched += 1;
  }
  return touched > 0;
}

type Rect = { id: string; top: number; left: number; width: number; height: number };

/** 多选模式：画选中框 + 拦截点击做勾选 + 底部浮条 */
export function TableMultiSelectLayer({ editor }: { editor: unknown }) {
  const { active, ids } = useMultiSelect();
  const [hint, setHint] = useState("");
  const [rects, setRects] = useState<Rect[]>([]);

  // 选中框用覆盖层画：不依赖 BlockNote 的块结构，滚动和重排都跟得上
  useEffect(() => {
    if (!active || ids.length === 0) {
      setRects([]);
      return;
    }
    const measure = () => {
      const next: Rect[] = [];
      for (const id of ids) {
        const el = document.querySelector(`.bn-block[data-id="${id}"]`);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        next.push({ id, top: r.top, left: r.left, width: r.width, height: r.height });
      }
      setRects(next);
    };
    measure();
    const timer = window.setInterval(measure, 300);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [active, ids]);

  // 多选时点表格块 = 勾选，不移动光标
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const host = target?.closest?.('[data-content-type="table"]') as HTMLElement | null;
      if (!host) return;
      const block = host.closest(".bn-block") as HTMLElement | null;
      const id = block?.getAttribute("data-id");
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      toggleTable(id);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [active]);

  if (!active) return null;

  const ed = editor as EditorLike;

  const merge = () => {
    const res = mergeSelectedTables(ed, ids);
    if (res.ok) {
      setHint(`已合并 ${res.merged} 张表`);
      exitMultiSelect();
    } else {
      setHint("至少选两张表格才能合并");
    }
  };

  const header = (kind: "headerRows" | "headerCols") => {
    const first = ids[0] ? blockContent(ed, ids[0]) : null;
    const on = kind === "headerRows" ? Boolean(first?.headerRows) : Boolean(first?.headerCols);
    applyHeadersToSelected(ed, ids, kind, on ? undefined : 1);
    setHint(on ? "已取消表头" : "已设为表头");
  };

  return (
    <>
      {rects.map((r) => (
        <div
          key={r.id}
          className={s.mark}
          style={{ top: r.top - 3, left: r.left - 3, width: r.width + 6, height: r.height + 6 }}
          aria-hidden="true"
        />
      ))}
      <div className={s.bar} role="toolbar" aria-label="表格多选">
        <span className={s.count}>已选 {ids.length} 张表格</span>
        <span className={s.sep} />
        <button type="button" className={s.btn} onClick={merge} disabled={ids.length < 2}>
          合并表格
        </button>
        <button type="button" className={s.btn} onClick={() => header("headerRows")} disabled={ids.length === 0}>
          表头行
        </button>
        <button type="button" className={s.btn} onClick={() => header("headerCols")} disabled={ids.length === 0}>
          表头列
        </button>
        <span className={s.spacer} />
        {hint && <span className={s.hint}>{hint}</span>}
        <button type="button" className={s.exit} onClick={exitMultiSelect}>
          退出多选
        </button>
      </div>
    </>
  );
}

/** 工具条用：进入多选并预选当前表格 */
export function useEnterMultiSelect() {
  return useCallback((blockId: string) => {
    enterMultiSelect(blockId ? [blockId] : []);
  }, []);
}
