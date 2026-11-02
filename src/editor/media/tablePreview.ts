/**
 * 表格工具条的「悬停预览范围」几何计算（纯函数）。
 *
 * 以前这段埋在 `TableToolbar` 的 `computeMarks` 里：既读 DOM 又算几何，
 * 于是只能靠在真实页面里量框来验证。抽出来之后，
 * 只要喂一串矩形坐标就能断言「本行上移」到底会画几个框、画在哪。
 */

export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
  /** on = 操作对象；target = 移动落点 */
  kind: "on" | "target";
};

/** 预览要标出的操作类型 */
export type PreviewSpec =
  | { kind: "row" }
  | { kind: "col" }
  | { kind: "cell" }
  | { kind: "table" }
  | { kind: "move-row"; dir: -1 | 1 }
  | { kind: "move-col"; dir: -1 | 1 };

export type PreviewContext = {
  /** 当前格子在表格里的位置（0 基） */
  pos: { row: number; col: number };
  /** 表格行数 */
  rowCount: number;
  /** 表格列数 */
  colCount: number;
  /** 整张表的外接矩形 */
  tableRect: Rect;
  /** 取某个格子的矩形；跨行跨列合并后不存在的格子返回 null */
  cellRect: (row: number, col: number) => Rect | null;
};

const union = (list: Rect[], kind: Rect["kind"] = "on"): Rect | null => {
  if (list.length === 0) return null;
  const left = Math.min(...list.map((r) => r.left));
  const top = Math.min(...list.map((r) => r.top));
  const right = Math.max(...list.map((r) => r.left + r.width));
  const bottom = Math.max(...list.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top, kind };
};

const rowRects = (ctx: PreviewContext, row: number): Rect[] => {
  const out: Rect[] = [];
  for (let c = 0; c < ctx.colCount; c += 1) {
    const r = ctx.cellRect(row, c);
    if (r) out.push(r);
  }
  return out;
};

const colRects = (ctx: PreviewContext, col: number): Rect[] => {
  const out: Rect[] = [];
  for (let r = 0; r < ctx.rowCount; r += 1) {
    const cell = ctx.cellRect(r, col);
    if (cell) out.push(cell);
  }
  return out;
};

/**
 * 返回这次悬停应该画出的框。
 * - row / col / cell / table：一个框
 * - move-row / move-col：本行（或本列）一个实线框 + 落点一个框（落点越界就没有）
 */
export function previewRects(spec: PreviewSpec, ctx: PreviewContext): Rect[] {
  const { row, col } = ctx.pos;

  switch (spec.kind) {
    case "row": {
      const r = union(rowRects(ctx, row));
      return r ? [r] : [];
    }
    case "col": {
      const r = union(colRects(ctx, col));
      return r ? [r] : [];
    }
    case "cell": {
      const r = ctx.cellRect(row, col);
      return r ? [{ ...r, kind: "on" }] : [];
    }
    case "table":
      return [{ ...ctx.tableRect, kind: "on" }];
    case "move-row": {
      const mine = union(rowRects(ctx, row));
      const destRow = row + spec.dir;
      const dest =
        destRow >= 0 && destRow < ctx.rowCount ? union(rowRects(ctx, destRow), "target") : null;
      return [...(mine ? [mine] : []), ...(dest ? [dest] : [])];
    }
    case "move-col": {
      const mine = union(colRects(ctx, col));
      const destCol = col + spec.dir;
      const dest =
        destCol >= 0 && destCol < ctx.colCount ? union(colRects(ctx, destCol), "target") : null;
      return [...(mine ? [mine] : []), ...(dest ? [dest] : [])];
    }
  }
}
