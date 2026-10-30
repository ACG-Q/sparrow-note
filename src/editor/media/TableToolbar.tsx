import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TextSelection, type EditorState, type Transaction } from "prosemirror-state";
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  mergeCells,
  splitCell,
} from "prosemirror-tables";
import type { AppEditor } from "../schema";
import {
  colIndexOf,
  isMultiCellSelection,
  setAlignForSelection,
  deleteTable,
  findTable,
  moveColumn,
  moveRow,
  resizeTable,
  selectRowOrColumn,
  setColumnAlign,
} from "./tableOps";
import { enterMultiSelect, useMultiSelect } from "./TableMultiSelect";
import { FeatureHint, type FeatureHintData } from "../../components/FeatureHint";
import { previewRects, type PreviewSpec } from "./tablePreview";
import s from "./TableToolbar.module.css";

type Target = {
  blockId: string;
  /** 鼠标所在的单元格（触屏可能为空，用选区推断） */
  cell: HTMLElement | null;
  /** 表格本体：行数/列数直接从这里数，不依赖编辑器状态 */
  tableEl: HTMLTableElement;
  /** 表格块（含内边距）的矩形：工具条按它定宽，窄表也撑满块宽 */
  rect: DOMRect;
};

const TABLE_SEL = '[data-content-type="table"]';
const MAX_GRID = 10;

/** 悬停菜单项时，表格上要标出「这次会动哪儿」 */
/** 预览框：屏幕坐标 + 是「操作对象」还是「移动落点」 */
type Rect = { left: number; top: number; width: number; height: number; kind: "on" | "target" };

type Preview =
  | { kind: "row"; row: number }
  | { kind: "col"; col: number }
  | { kind: "move-row"; row: number; dir: -1 | 1 }
  | { kind: "move-col"; col: number; dir: -1 | 1 }
  | { kind: "table" }
  | { kind: "cell" }
  | null;

/**
 * 表格工具条：贴在表头上方，跟着可见区走（不随表格内容滚动）。
 * 增删行列用 prosemirror-tables 的命令；整列对齐 / 改尺寸 / 删表用自己的事务。
 * 两条路径都落在同一个 ProseMirror 历史里，可以撤销。
 */
export function TableToolbar({ editor }: { editor: AppEditor }) {
  const multi = useMultiSelect();
  const [target, setTarget] = useState<Target | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [draft, setDraft] = useState({ rows: 0, cols: 0 });
  const [hoverSize, setHoverSize] = useState<{ rows: number; cols: number } | null>(null);
  const [, bump] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preview, setPreview] = useState<Preview>(null);
  const [marks, setMarks] = useState<Rect[]>([]);
  const [hintData, setHintData] = useState<FeatureHintData | null>(null);
  const [hint, setHint] = useState("");
  const [shrink, setShrink] = useState<{ rows: number; cols: number } | null>(null);
  const hintTimer = useRef(0);
  const shrinkRef = useRef<{ rows: number; cols: number } | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<Target | null>(null);
  targetRef.current = target;

  const readSize = useCallback(() => {
    const el = targetRef.current?.tableEl;
    if (!el) return { rows: 0, cols: 0 };
    const rows = el.rows.length;
    const first = el.rows[0];
    let cols = 0;
    if (first) for (const c of Array.from(first.cells)) cols += c.colSpan || 1;
    return { rows, cols };
  }, []);

  const computeFromDom = useCallback((cell: HTMLElement | null): Target | null => {
    const host = cell?.closest(TABLE_SEL) as HTMLElement | null;
    if (!host) return null;
    const block = host.closest(".bn-block") as HTMLElement | null;
    const table = (host.querySelector("table") ?? host) as HTMLTableElement;
    return {
      blockId: block?.getAttribute("data-id") ?? "",
      cell,
      tableEl: table,
      // 用表格块的矩形而不是 <table>：2 列的窄表也要撑满整块宽度
      rect: host.getBoundingClientRect(),
    };
  }, []);

  // 指针在表格里移动 → 记录目标；离开不收起（否则移向工具条时会被卸载）
  useEffect(() => {
    const root = editor.prosemirrorView?.dom;
    if (!root) return;
    const onMove = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const cell = t?.closest?.("td, th") as HTMLElement | null;
      if (!cell) return;
      const next = computeFromDom(cell);
      if (!next) return;
      setTarget((prev) =>
        prev && prev.blockId === next.blockId && prev.cell === next.cell ? prev : next,
      );
    };
    root.addEventListener("mouseover", onMove, true);
    return () => root.removeEventListener("mouseover", onMove, true);
  }, [editor, computeFromDom]);

  /**
   * 指针离开表格和浮条后收起工具条。
   * 用延迟 + 进浮条取消，避免「从表格移到 30px 上的浮条」这段空隙把工具条收掉。
   */
  useEffect(() => {
    const timer = { id: 0 };
    const keep = () => window.clearTimeout(timer.id);
    const schedule = () => {
      window.clearTimeout(timer.id);
      timer.id = window.setTimeout(() => {
        setTarget(null);
        setMenuOpen(false);
        setSizeOpen(false);
      }, 260);
    };
    const onMove = (e: PointerEvent) => {
      const node = e.target as HTMLElement | null;
      if (node && barRef.current?.contains(node)) {
        keep();
        return;
      }
      if (node?.closest?.(TABLE_SEL)) {
        keep();
        return;
      }
      schedule();
    };
    document.addEventListener("pointermove", onMove, true);
    return () => {
      document.removeEventListener("pointermove", onMove, true);
      window.clearTimeout(timer.id);
    };
  }, []);

  // 触屏 / 键盘：靠选区判断是否在表格里
  const syncFromSelection = useCallback(() => {
    const view = editor.prosemirrorView;
    if (!view) return;
    const found = findTable(view.state);
    if (!found) {
      setTarget(null);
      setMenuOpen(false);
      setSizeOpen(false);
      return;
    }
    const dom = view.domAtPos(view.state.selection.from).node;
    const el = (dom instanceof HTMLElement ? dom : dom.parentElement) as HTMLElement | null;
    const host = el?.closest?.(TABLE_SEL) as HTMLElement | null;
    if (!host) return;
    const block = host.closest(".bn-block") as HTMLElement | null;
    const cell = (el?.closest?.("td, th") as HTMLElement | null) ?? null;
    const table = (host.querySelector("table") ?? host) as HTMLTableElement;
    setTarget({
      blockId: block?.getAttribute("data-id") ?? "",
      cell,
      tableEl: table,
      rect: host.getBoundingClientRect(),
    });
  }, [editor]);

  useEffect(() => {
    const root = editor.prosemirrorView?.dom;
    if (!root) return;
    let timer = 0;
    const onUp = () => syncFromSelection();
    // 触屏点一下不会稳定触发 mouseup/focusin，selectionchange 是最可靠的信号
    const onSelChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onUp, 60);
    };
    root.addEventListener("mouseup", onUp);
    root.addEventListener("focusin", onUp);
    root.addEventListener("keyup", onUp);
    root.addEventListener("pointerup", onUp);
    document.addEventListener("selectionchange", onSelChange);
    return () => {
      window.clearTimeout(timer);
      root.removeEventListener("mouseup", onUp);
      root.removeEventListener("focusin", onUp);
      root.removeEventListener("keyup", onUp);
      root.removeEventListener("pointerup", onUp);
      document.removeEventListener("selectionchange", onSelChange);
    };
  }, [editor, syncFromSelection]);

  // 滚动 / 缩放：重算矩形（工具条钉在视口，不随内容滚）
  useEffect(() => {
    if (!target) return;
    const place = () => {
      const cell = targetRef.current?.cell;
      const host = (cell?.closest(TABLE_SEL) ?? document.querySelector(TABLE_SEL)) as HTMLElement | null;
      if (!host) return;
      setTarget((prev) => (prev ? { ...prev, rect: host.getBoundingClientRect() } : prev));
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [target]);

  /**
   * 把光标放回目标单元格，命令才有作用对象。
   * 但如果用户已经拖选了多个单元格（CellSelection），**不能覆盖**它——
   * 覆盖掉之后「合并单元格」就永远没东西可合并。
   */
  const focusCell = (view: NonNullable<typeof editor.prosemirrorView>) => {
    const sel = view.state.selection;
    if (isMultiCellSelection(sel) && findTable(view.state)) return;
    const cell = targetRef.current?.cell;
    if (!cell) return;
    try {
      const pos = view.posAtDOM(cell, 0);
      const next = TextSelection.near(view.state.doc.resolve(pos));
      view.dispatch(view.state.tr.setSelection(next));
    } catch {
      /* 单元格可能已经被删掉 */
    }
  };

  /** 操作被拒绝时给一句人话，而不是静默什么都不发生 */
  const say = (text: string) => {
    setHint(text);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(""), 2200);
  };

  const run = (
    cmd: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean,
    failHint = "这里不能这么做",
  ) => {
    const view = editor.prosemirrorView;
    if (!view) return;
    focusCell(view);
    const ok = cmd(view.state, view.dispatch);
    if (!ok) {
      say(failHint);
      return;
    }
    view.focus();
    setMenuOpen(false);
    bump((v) => v + 1);
  };

  const runOp = (
    op: (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean,
    failHint = "这里不能这么做",
  ) => {
    const view = editor.prosemirrorView;
    if (!view) return;
    focusCell(view);
    const ok = op(view.state, view.dispatch);
    if (!ok) {
      say(failHint);
      return;
    }
    view.focus();
    setMenuOpen(false);
    setSizeOpen(false);
    bump((v) => v + 1);
  };

  /**
   * 改尺寸：变大直接干；变小会删掉内容，必须先提示再确认一次。
   */
  const applySize = (r: number, c: number) => {
    const cur = readSize();
    const dropRows = Math.max(0, cur.rows - r);
    const dropCols = Math.max(0, cur.cols - c);
    if (dropRows > 0 || dropCols > 0) {
      const same =
        shrinkRef.current && shrinkRef.current.rows === r && shrinkRef.current.cols === c;
      if (!same) {
        shrinkRef.current = { rows: r, cols: c };
        setShrink({ rows: r, cols: c });
        say(
          dropRows > 0 && dropCols > 0
            ? `会删掉最后 ${dropRows} 行和 ${dropCols} 列，再点一次确认`
            : dropRows > 0
              ? `会删掉最后 ${dropRows} 行，再点一次确认`
              : `会删掉最后 ${dropCols} 列，再点一次确认`,
        );
        return;
      }
    }
    shrinkRef.current = null;
    setShrink(null);
    runOp((state, dispatch) => resizeTable(state, dispatch, r, c), "改不了尺寸");
  };


  const applyAlign = (align: "left" | "center" | "right") => {
    const view = editor.prosemirrorView;
    const cell = targetRef.current?.cell;
    if (!view) return;

    // 拖选了多格（含表头）时，按选区整片改，而不是只改最后悬停的那一列
    const sel = view.state.selection;
    if (isMultiCellSelection(sel)) {
      runOp(
        (state, dispatch) => setAlignForSelection(state, dispatch, align) > 0,
        "先选中要处理的单元格",
      );
      return;
    }

    if (!cell) return;
    const col = colIndexOf(cell);
    runOp((state, dispatch) => setColumnAlign(state, dispatch, col, align));
  };

  // 表格可能刚被合并/删除，元素已从文档移除：别把工具条挂在一张不存在的表上
  /** 当前光标/悬停所在格的行列号（0 基），取不到就当 0 */
  const cellPos = useCallback(() => {
    const t = targetRef.current;
    const el = t?.tableEl;
    if (!el || !t?.cell) return { row: 0, col: 0 };
    const rows = Array.from(el.rows);
    const row = Math.max(0, rows.findIndex((tr) => tr.contains(t.cell)));
    return { row, col: Math.max(0, colIndexOf(t.cell)) };
  }, []);

  /**
   * 把「这次会动哪儿」算成一组屏幕矩形。
   * 为什么不直接给 td 加 class：ProseMirror 会重建单元格 DOM，属性会被冲掉，
   * 所以改成在表格上方盖一层浮层画框。
   */
  const computeMarks = useCallback(
    (pv: Preview): Rect[] => {
      const el = targetRef.current?.tableEl;
      if (!el || !pv) return [];
      const rows = Array.from(el.rows);
      const { row, col } = cellPos();
      const rectOf = (n: Element): Rect => {
        const r = n.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height, kind: "on" };
      };
      const tableR = rectOf(el);
      // 几何计算交给纯函数（见 media/tablePreview.ts，那边有单测）
      const spec: PreviewSpec =
        pv.kind === "move-row"
          ? { kind: "move-row", dir: pv.dir < 0 ? -1 : 1 }
          : pv.kind === "move-col"
            ? { kind: "move-col", dir: pv.dir < 0 ? -1 : 1 }
            : { kind: pv.kind };
      return previewRects(spec, {
        pos: { row, col },
        rowCount: rows.length,
        colCount: Math.max(1, ...rows.map((tr) => tr.cells.length)),
        tableRect: tableR,
        cellRect: (r, c) => {
          const cell = rows[r]?.cells[c];
          return cell ? rectOf(cell) : null;
        },
      });
    },
    [cellPos],
  );

  useEffect(() => {
    setMarks(computeMarks(preview));
  }, [computeMarks, preview]);

  /** 菜单收起时把框和说明卡都收掉 */
  useEffect(() => {
    if (menuOpen) return;
    setPreview(null);
    setHintData(null);
  }, [menuOpen]);

  useEffect(() => {
    if (!target) {
      setPreview(null);
      setHintData(null);
      setMarks([]);
    }
  }, [target]);

  /** 一个菜单项的悬停行为：标范围 + 出说明卡 */
  const hover = (make: () => Preview, data: FeatureHintData) => ({
    onPointerEnter: () => {
      setPreview(make());
      setHintData(data);
    },
    onPointerLeave: () => {
      setPreview(null);
      setHintData(null);
    },
  });

  if (!target) return null;
  if (!target.tableEl.isConnected) return null;
  // 多选模式下由底部浮条接管，两个浮层叠在一起谁都点不准
  if (multi.active) return null;

  const { rect } = target;
  const { rows, cols } = readSize();
  const shown = hoverSize ?? { rows, cols };
  const cell = target.cell;
  const colIndex = cell ? colIndexOf(cell) : 0;
  const rowIndex = cell?.parentElement
    ? [...(cell.parentElement.parentElement?.children ?? [])].indexOf(cell.parentElement as Element)
    : 0;
  const alignNow = (() => {
    const view = editor.prosemirrorView;
    const sel = view?.state.selection;
    if (isMultiCellSelection(sel) && cell) {
      const first = cell.parentElement?.querySelector("td, th") ?? cell;
      const raw0 = getComputedStyle(first).textAlign;
      return raw0 === "start" ? "left" : raw0 === "end" ? "right" : raw0;
    }
    const raw = cell ? getComputedStyle(cell).textAlign : "left";
    return raw === "start" ? "left" : raw === "end" ? "right" : raw;
  })();
  const runAt = (rowDelta: -1 | 0 | 1, colDelta: -1 | 0 | 1) => {
    const fail = colDelta
      ? colDelta < 0
        ? "已经在最左边了"
        : "已经在最右边了"
      : rowDelta < 0
        ? "已经在最上面了"
        : "已经在最下面了";
    runOp(
      (state, dispatch) =>
        colDelta
          ? moveColumn(state, dispatch, colIndex, colDelta as -1 | 1)
          : moveRow(state, dispatch, rowIndex, (rowDelta || 1) as -1 | 1),
      fail,
    );
  };
  // 工具条宽度跟随表格本体：右端的「⋯」正好落在表格右缘，和 Typora 一致
  // 上方留得出空间就朝上弹，盖住标题而不是盖住表格前几行
  const flip = rect.top - 30 > 240;
  const left = Math.max(8, rect.left);
  const width = Math.max(260, Math.min(rect.width, window.innerWidth - left - 8));
  const top = Math.max(8, rect.top - 30);

  return (
    <div ref={barRef} className={s.bar} style={{ top, left, width }} contentEditable={false} role="toolbar" aria-label="表格工具">
      <button
        type="button"
        className={`${s.btn} ${s.sizeBtn}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setSizeOpen(true);
          setMenuOpen(false);
          setDraft({ rows: 0, cols: 0 });
          setHoverSize(null);
        }}
        aria-expanded={sizeOpen}
        title="表格尺寸"
      >
        <span className={s.gridIcon} aria-hidden="true">
          {Array.from({ length: 9 }).map((_, i) => (
            <i key={i} />
          ))}
        </span>
        {rows}×{cols}
      </button>

      <span className={s.sep} />

      <button type="button" className={alignNow === "left" ? `${s.btn} ${s.btnOn}` : s.btn} onMouseDown={(e) => e.preventDefault()} onClick={() => applyAlign("left")} title="整列左对齐">
        ≡左
      </button>
      <button type="button" className={alignNow === "center" ? `${s.btn} ${s.btnOn}` : s.btn} onMouseDown={(e) => e.preventDefault()} onClick={() => applyAlign("center")} title="整列居中">
        ≡中
      </button>
      <button type="button" className={alignNow === "right" ? `${s.btn} ${s.btnOn}` : s.btn} onMouseDown={(e) => e.preventDefault()} onClick={() => applyAlign("right")} title="整列右对齐">
        ≡右
      </button>

      <span className={s.sep} />

      <button type="button" className={s.btn} onMouseDown={(e) => e.preventDefault()} onClick={() => run(addRowAfter)} title="在下方插入一行">
        ＋行
      </button>
      <button type="button" className={s.btn} onMouseDown={(e) => e.preventDefault()} onClick={() => run(addColumnAfter)} title="在右侧插入一列">
        ＋列
      </button>

      <span className={s.spacer} />

      {hint && <span className={s.hint}>{hint}</span>}

      <button
        type="button"
        className={menuOpen ? `${s.btn} ${s.btnOn}` : s.btn}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setMenuOpen(true);
          setSizeOpen(false);
          setConfirmDelete(false);
        }}
        aria-expanded={menuOpen}
        title="更多"
      >
        ⋯
      </button>

      {sizeOpen && (
        <div className={flip ? `${s.pop} ${s.popUp}` : s.pop} role="dialog" aria-label="表格尺寸">
          <div className={s.grid} style={{ gridTemplateColumns: `repeat(${MAX_GRID}, 18px)` }}>
            {Array.from({ length: MAX_GRID * MAX_GRID }).map((_, i) => {
              const r = Math.floor(i / MAX_GRID) + 1;
              const c = (i % MAX_GRID) + 1;
              const hot = r <= shown.rows && c <= shown.cols;
              return (
                <button
                  key={i}
                  type="button"
                  className={hot ? `${s.gridCell} ${s.gridHot}` : s.gridCell}
                  onMouseEnter={() => setHoverSize({ rows: r, cols: c })}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applySize(r, c);
                    setHoverSize(null);
                  }}
                  aria-label={`${r} 行 ${c} 列`}
                />
              );
            })}
          </div>
          <div className={s.sizeRow}>
            <input
              className={s.sizeInput}
              type="number"
              min={1}
              max={30}
              value={draft.rows || rows}
              onChange={(e) => setDraft((d) => ({ ...d, rows: Number(e.target.value) }))}
              aria-label="行数"
            />
            <span className={s.times}>×</span>
            <input
              className={s.sizeInput}
              type="number"
              min={1}
              max={12}
              value={draft.cols || cols}
              onChange={(e) => setDraft((d) => ({ ...d, cols: Number(e.target.value) }))}
              aria-label="列数"
            />
            <button
              type="button"
              className={s.okBtn}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const r = Math.max(1, Math.min(30, draft.rows || rows));
                const c = Math.max(1, Math.min(12, draft.cols || cols));
                applySize(r, c);
              }}
            >
              {shrink ? "确认删除" : "确定"}
            </button>
          </div>
        </div>
      )}

      <FeatureHint data={hintData} />
      {marks.length > 0 &&
        createPortal(
          <div className={s.pvLayer} aria-hidden="true">
            {marks.map((m, i) => (
              <span
                key={i}
                className={m.kind === "on" ? s.pvOn : s.pvTarget}
                style={{ left: m.left, top: m.top, width: m.width, height: m.height }}
              />
            ))}
          </div>,
          document.body,
        )}
      {menuOpen && (
        <div className={flip ? `${s.menu} ${s.menuUp}` : s.menu} role="menu">
          <button type="button" className={s.item} onMouseDown={(e) => e.preventDefault()} onClick={() => runOp((state, dispatch) => selectRowOrColumn(state, dispatch, "row"), "选不了这一行")}
            {...hover(() => ({ kind: "row", row: cellPos().row }), {
              title: "选中本行",
              glyph: "⇤",
              desc: "把光标所在的一整行变成选区，之后整行对齐、整行删除都作用于它。",
              notes: ["选中后点工具条的对齐，改的是整行", "Ctrl / ⌘ + Z 可撤销"],
            })}>
            选中本行
          </button>
          <button type="button" className={s.item} onMouseDown={(e) => e.preventDefault()} onClick={() => runOp((state, dispatch) => selectRowOrColumn(state, dispatch, "col"), "这一列上有合并单元格，先拆分再选")}
            {...hover(() => ({ kind: "col", col: cellPos().col }), {
              title: "选中本列",
              glyph: "⇡",
              desc: "把光标所在的一整列变成选区。",
              notes: ["列上有合并单元格时会先提示，拆开后再选", "Ctrl / ⌘ + Z 可撤销"],
            })}>
            选中本列
          </button>
          <span className={s.menuSep} />
          <button type="button" className={s.item} onMouseDown={(e) => e.preventDefault()} onClick={() => run(mergeCells, "先拖选要合并的单元格，或用「选中本行 / 本列」")}
            {...hover(() => ({ kind: "cell" }), {
              title: "合并选中单元格",
              glyph: "⊞",
              desc: "把拖选的多个格子并成一个；只保留左上角那格的位置，内容会拼进去。",
              notes: ["先拖选或多选，再点这里", "合并后这一格不能再拆成多块"],
            })}>
            合并选中单元格
          </button>
          <button type="button" className={s.item} onMouseDown={(e) => e.preventDefault()} onClick={() => run(splitCell, "这个单元格没有合并")}
            {...hover(() => ({ kind: "cell" }), {
              title: "拆分单元格",
              glyph: "⊟",
              desc: "把合并过的格子还原成独立的小格。",
              notes: ["只对合并过的格子有效", "内容留在左上那格，不会复制到其它格"],
            })}>
            拆分单元格
          </button>
          <span className={s.menuSep} />
          <button type="button" className={s.item} onMouseDown={(e) => e.preventDefault()} onClick={() => run(deleteRow, "只剩一行了，删不掉")}
            {...hover(() => ({ kind: "row", row: cellPos().row }), {
              title: "删除本行",
              glyph: "⌫行",
              desc: "删掉光标所在的整行，连同里面的内容。",
              notes: ["只剩一行时删不掉", "Ctrl / ⌘ + Z 可撤销"],
            })}>
            删除本行
          </button>
          <button type="button" className={s.item} onMouseDown={(e) => e.preventDefault()} onClick={() => run(deleteColumn, "只剩一列了，删不掉")}
            {...hover(() => ({ kind: "col", col: cellPos().col }), {
              title: "删除本列",
              glyph: "⌫列",
              desc: "删掉光标所在的整列，连同里面的内容。",
              notes: ["只剩一列时删不掉", "Ctrl / ⌘ + Z 可撤销"],
            })}>
            删除本列
          </button>
          <span className={s.menuSep} />
          <button type="button" className={s.item} onMouseDown={(e) => e.preventDefault()} onClick={() => runAt(-1, 0)}
            {...hover(() => ({ kind: "move-row", row: cellPos().row, dir: -1 }), {
              title: "本行上移",
              glyph: "↑",
              desc: "和上面一行交换位置；实线标记是这一行，虚线是它会去的位置。",
              notes: ["已经是第一行时不动", "表头行也会一起被换走"],
            })}>
            本行上移
          </button>
          <button type="button" className={s.item} onMouseDown={(e) => e.preventDefault()} onClick={() => runAt(1, 0)}
            {...hover(() => ({ kind: "move-row", row: cellPos().row, dir: 1 }), {
              title: "本行下移",
              glyph: "↓",
              desc: "和下面一行交换位置；实线标记是这一行，虚线是它会去的位置。",
              notes: ["已经是最后一行时不动", "表头行也会一起被换走"],
            })}>
            本行下移
          </button>
          <button type="button" className={s.item} onMouseDown={(e) => e.preventDefault()} onClick={() => runAt(0, -1)}
            {...hover(() => ({ kind: "move-col", col: cellPos().col, dir: -1 }), {
              title: "本列左移",
              glyph: "←",
              desc: "和左边一列交换位置；实线标记是这一列，虚线是它会去的位置。",
              notes: ["已经是第一列时不动", "表头列也会一起被换走"],
            })}>
            本列左移
          </button>
          <button type="button" className={s.item} onMouseDown={(e) => e.preventDefault()} onClick={() => runAt(0, 1)}
            {...hover(() => ({ kind: "move-col", col: cellPos().col, dir: 1 }), {
              title: "本列右移",
              glyph: "→",
              desc: "和右边一列交换位置；实线标记是这一列，虚线是它会去的位置。",
              notes: ["已经是最后一列时不动", "表头列也会一起被换走"],
            })}>
            本列右移
          </button>

          <button
            type="button"
            className={s.item}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              enterMultiSelect(target.blockId ? [target.blockId] : []);
              setMenuOpen(false);
            }}
            {...hover(() => ({ kind: "table" }), {
              title: "多选表格（批量）",
              glyph: "▦×",
              desc: "进入批量模式：这一张先被勾上，再点其它表格加入选择。",
              notes: [
                "这是页面级模式，不是只改当前这一张",
                "底部浮条可以批量设表头、合并、删除",
                "点浮条右边的「退出多选」结束",
              ],
            })}
          >
            多选表格（批量）
          </button>
          <span className={s.menuSep} />
          {confirmDelete ? (
            <button
              type="button"
              className={`${s.item} ${s.danger}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                runOp((state, dispatch) => deleteTable(state, dispatch));
                setConfirmDelete(false);
              }}
            >
              确认删除整张表格？
            </button>
          ) : (
            <button
              type="button"
              className={`${s.item} ${s.danger}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setConfirmDelete(true)}
            {...hover(() => ({ kind: "table" }), {
              title: "删除表格",
              glyph: "✕",
              desc: "整张表格连同所有内容一起删掉。",
              notes: ["会再确认一次才真的删", "Ctrl / ⌘ + Z 可撤销"],
            })}
            >
              删除表格
            </button>
          )}
        </div>
      )}
    </div>
  );
}
