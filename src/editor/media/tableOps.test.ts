// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  colIndexOf,
  setAlignForSelection,
  deleteTable,
  findTable,
  isMultiCellSelection,
  moveColumn,
  moveRow,
  resizeTable,
  setColumnAlign,
  tableSize,
} from "./tableOps";

/**
 * 表格批量操作用「假 ProseMirror 节点」驱动：
 * 只实现被测代码真正用到的那几个成员（type.create / forEach / nodeSize / attrs…），
 * 这样能验证行列增删、移动、对齐这些纯逻辑，而不必起一个真编辑器。
 */
type FakeNode = {
  type: { name: string; create: (attrs: unknown, content: FakeNode[], marks?: unknown) => FakeNode; createAndFill: (attrs: unknown) => FakeNode | null };
  attrs: Record<string, unknown>;
  marks: unknown;
  content: FakeNode[];
  nodeSize: number;
  childCount: number;
  forEach: (f: (n: FakeNode, offset: number, index: number) => void) => void;
  child: (i: number) => FakeNode;
};

const node = (name: string, attrs: Record<string, unknown>, children: FakeNode[] = []): FakeNode => {
  const n: FakeNode = {
    type: {
      name,
      create: (a: unknown, content: FakeNode[] = []) =>
        node(name, (a ?? {}) as Record<string, unknown>, content),
      createAndFill: (a: unknown) => node(name, (a ?? {}) as Record<string, unknown>, []),
    },
    attrs,
    marks: [],
    content: children,
    nodeSize: 2 + children.reduce((s, c) => s + c.nodeSize, 0),
    childCount: children.length,
    forEach: (f) => children.forEach((c, i) => f(c, 0, i)),
    child: (i) => children[i],
  };
  return n;
};

const cell = (text = "", attrs: Record<string, unknown> = {}) => node("tableCell", { colspan: 1, rowspan: 1, text, ...attrs });
const row = (cells: FakeNode[]) => node("tableRow", {}, cells);
const table = (rows: FakeNode[]) => node("table", { textColor: "default" }, rows);
const doc = (blocks: FakeNode[]) => node("doc", {}, blocks);

/** 把 doc 包成 editor state 的替身：光标落在表格里的指定 depth */
function stateWith(box: FakeNode, opts: { depth?: number; inTable?: boolean } = {}) {
  const depth = opts.depth ?? 1;
  const $from = {
    depth,
    node: (d: number) => (d === depth ? box : doc([])),
    before: () => 0,
    parent: row([cell()]),
  };
  const tr = {
    replaceWith: vi.fn(() => tr),
    delete: vi.fn(() => tr),
    setSelection: vi.fn(() => tr),
    setNodeMarkup: vi.fn(() => tr),
  };
  const state = {
    selection: opts.inTable === false ? { $from: { ...$from, depth: 1, node: () => doc([]) } } : { $from },
    tr,
  };
  return { state: state as never, tr };
}

describe("findTable / tableSize", () => {
  it("光标在表格里时能找到表", () => {
    const t = table([row([cell("a"), cell("b")]), row([cell("c"), cell("d")])]);
    const { state } = stateWith(t);
    expect(findTable(state)?.node).toBe(t);
  });

  it("光标不在表格里返回 null", () => {
    const { state } = stateWith(table([]), { inTable: false });
    expect(findTable(state)).toBeNull();
  });

  it("tableSize 按最长行算列数", () => {
    const t = table([row([cell(), cell(), cell()]), row([cell(), cell()])]);
    expect(tableSize(t as never)).toEqual({ rows: 2, cols: 3 });
  });
});

describe("colIndexOf（DOM）", () => {
  it("把 colspan 算进列号", () => {
    const tr = document.createElement("tr");
    const a = document.createElement("td");
    a.setAttribute("colspan", "2");
    const b = document.createElement("td");
    tr.append(a, b);
    expect(colIndexOf(a)).toBe(0);
    expect(colIndexOf(b)).toBe(2);
  });

  it("没有父元素时返回 0", () => {
    expect(colIndexOf(document.createElement("td"))).toBe(0);
  });
});

describe("isMultiCellSelection", () => {
  it("跨格选区（有 $anchorCell 且 from≠to）为 true", () => {
    expect(isMultiCellSelection({ $anchorCell: {}, from: 1, to: 5 })).toBe(true);
  });

  it("普通文本光标为 false", () => {
    expect(isMultiCellSelection({ from: 1, to: 1 })).toBe(false);
    expect(isMultiCellSelection(null)).toBe(false);
    expect(isMultiCellSelection("x")).toBe(false);
  });
});

describe("resizeTable", () => {
  it("加列：每行补齐到目标列数", () => {
    const t = table([row([cell("a")]), row([cell("b")])]);
    const { state, tr } = stateWith(t);
    expect(resizeTable(state, () => {}, 2, 3)).toBe(true);
    const written = tr.replaceWith.mock.calls[0] as unknown as [number, number, FakeNode];
    const next = written[2];
    expect(next.childCount).toBe(2);
    expect(next.child(0).childCount).toBe(3);
  });

  it("减行：多出来的行被砍掉", () => {
    const t = table([row([cell()]), row([cell()]), row([cell()])]);
    const { state, tr } = stateWith(t);
    resizeTable(state, () => {}, 1, 1);
    const next = (tr.replaceWith.mock.calls[0] as unknown as [number, number, FakeNode])[2];
    expect(next.childCount).toBe(1);
  });

  it("行列都没变时不动文档", () => {
    const t = table([row([cell()]), row([cell()])]);
    const { state, tr } = stateWith(t);
    expect(resizeTable(state, () => {}, 2, 1)).toBe(true);
    expect(tr.replaceWith).not.toHaveBeenCalled();
  });

  it("没有表格时返回 false", () => {
    const { state } = stateWith(table([]), { inTable: false });
    expect(resizeTable(state, () => {}, 2, 2)).toBe(false);
  });

  it("dispatch 为空也不崩（只读探测）", () => {
    const t = table([row([cell()])]);
    const { state } = stateWith(t);
    expect(resizeTable(state, undefined, 2, 2)).toBe(true);
  });
});

describe("deleteTable", () => {
  it("删整表走 tr.delete", () => {
    const t = table([row([cell()])]);
    const { state, tr } = stateWith(t);
    expect(deleteTable(state, () => {})).toBe(true);
    expect(tr.delete).toHaveBeenCalled();
  });

  it("没有表格返回 false", () => {
    const { state } = stateWith(table([]), { inTable: false });
    expect(deleteTable(state, () => {})).toBe(false);
  });
});

describe("moveRow / moveColumn", () => {
  it("行上移：交换相邻两行", () => {
    const r1 = row([cell("1")]);
    const r2 = row([cell("2")]);
    const t = table([r1, r2]);
    const { state, tr } = stateWith(t);
    expect(moveRow(state, () => {}, 1, -1)).toBe(true);
    const next = (tr.replaceWith.mock.calls[0] as unknown as [number, number, FakeNode])[2];
    expect(next.child(0).child(0).attrs.text).toBe("2");
  });

  it("第一行再上移：返回 false", () => {
    const t = table([row([cell()])]);
    const { state } = stateWith(t);
    expect(moveRow(state, () => {}, 0, -1)).toBe(false);
  });

  it("列右移：交换单元格", () => {
    const t = table([row([cell("左"), cell("右")])]);
    const { state, tr } = stateWith(t);
    expect(moveColumn(state, () => {}, 0, 1)).toBe(true);
    const next = (tr.replaceWith.mock.calls[0] as unknown as [number, number, FakeNode])[2];
    expect(next.child(0).child(0).attrs.text).toBe("右");
  });

  it("最后一列再右移：返回 false", () => {
    const t = table([row([cell(), cell()])]);
    const { state } = stateWith(t);
    expect(moveColumn(state, () => {}, 1, 1)).toBe(false);
  });

  it("没有表格时返回 false", () => {
    const { state } = stateWith(table([]), { inTable: false });
    expect(moveRow(state, () => {}, 0, 1)).toBe(false);
    expect(moveColumn(state, () => {}, 0, 1)).toBe(false);
  });
});

describe("setColumnAlign", () => {
  it("把整列单元格的 textAlignment 改成目标值", () => {
    const t = table([
      row([cell("a", { textAlignment: "left" }), cell("b", { textAlignment: "left" })]),
      row([cell("c", { textAlignment: "left" }), cell("d", { textAlignment: "left" })]),
    ]);
    const { state, tr } = stateWith(t, { depth: 2 });
    const ok = setColumnAlign(state, () => {}, 0, "center");
    expect(ok).toBe(true);
    expect(tr.replaceWith).toHaveBeenCalled();
  });

  it("没有表格时返回 false", () => {
    const { state } = stateWith(table([]), { inTable: false });
    expect(setColumnAlign(state, () => {}, 0, "center")).toBe(false);
  });
});

describe("setAlignForSelection（跨格选区）", () => {
  const withSelection = (st: unknown, cells: FakeNode[]) => {
    const sel = st as { selection: Record<string, unknown> };
    (sel.selection as Record<string, unknown>).forEachCell = (f: (node: FakeNode, pos: number) => void) =>
      cells.forEach((c, i) => f(c, i + 1));
    (sel.selection as Record<string, unknown>).from = 1;
    (sel.selection as Record<string, unknown>).to = 9;
    return st;
  };

  it("选区里每一格都改对齐，返回命中格数", () => {
    const t = table([row([cell("a"), cell("b")])]);
    const { state, tr } = stateWith(t);
    withSelection(state, [cell("a"), cell("b")]);
    const n = setAlignForSelection(state, () => {}, "center");
    expect(n).toBe(2);
    expect(tr.setNodeMarkup).toHaveBeenCalledTimes(2);
  });

  it("没有表格时返回 0", () => {
    const { state } = stateWith(table([]), { inTable: false });
    expect(setAlignForSelection(state, () => {}, "left")).toBe(0);
  });

  it("dispatch 为空时只读探测也能算出格数", () => {
    const t = table([row([cell("a")])]);
    const { state } = stateWith(t);
    withSelection(state, [cell("a")]);
    expect(setAlignForSelection(state, undefined, "right")).toBe(1);
  });
});
