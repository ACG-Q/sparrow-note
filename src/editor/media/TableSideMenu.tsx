import { useState, type FC, type ReactNode } from "react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  AddBlockButton,
  BlockColorsItem,
  DragHandleButton,
  DragHandleMenu,
  RemoveBlockItem,
  SideMenu,
  useBlockNoteEditor,
  useExtensionState,
  type SideMenuProps,
} from "@blocknote/react";
import s from "./TableSideMenu.module.css";

/** 表格内容的最小结构，够我们改行列用就行，其余字段原样透传 */
type TableContent = {
  type: "tableContent";
  rows: { cells: unknown[] }[];
  columnWidths?: unknown;
  headerRows?: number;
  headerCols?: number;
};

type TableBlock = {
  type: string;
  id: string;
  content: TableContent;
};

/** 左侧 ⋮⋮ 当前悬停的块（BlockNote 把状态放在 SideMenuExtension 里） */
function useHoveredTable(): TableBlock | undefined {
  const editor = useBlockNoteEditor();
  return useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block as unknown as TableBlock | undefined,
  });
}

const EMPTY_CELL = { type: "tableCell", content: [], props: {} };

/** 块类型是泛型联合，这里只改确知的表格内容，边界处一次性收窄 */
type UpdateFn = (block: unknown, update: unknown) => void;

function updateContent(editor: unknown, block: TableBlock, content: TableContent) {
  const update = (editor as { updateBlock: UpdateFn }).updateBlock;
  update.call(editor, block, { content });
}

/** 表格相关的菜单项：不是表格块时整组不渲染 */
function TableItems({ children, run }: { children: ReactNode; run: (block: TableBlock) => void }) {
  const block = useHoveredTable();
  if (!block || block.type !== "table") return null;
  return (
    <button type="button" className={s.item} role="menuitem" onClick={() => run(block)}>
      {children}
    </button>
  );
}

function AddRowItem() {
  const editor = useBlockNoteEditor();
  return (
    <TableItems
      run={(block) => {
        const { rows } = block.content;
        const width = rows[0]?.cells.length ?? 1;
        const cells = Array.from({ length: width }, () => EMPTY_CELL);
        updateContent(editor, block, { ...block.content, rows: [...rows, { cells }] });
      }}
    >
      在末尾加一行
    </TableItems>
  );
}

function AddColumnItem() {
  const editor = useBlockNoteEditor();
  return (
    <TableItems
      run={(block) => {
        updateContent(editor, block, {
          ...block.content,
          rows: block.content.rows.map((r) => ({ ...r, cells: [...r.cells, EMPTY_CELL] })),
        });
      }}
    >
      在右侧加一列
    </TableItems>
  );
}

/** 表头行/列的候选值：够用就好，不做无限步进 */
const HEADER_STEPS = [0, 1, 2, 3];

/**
 * 表头数量选择。BlockNote 自带的 TableRowHeaderItem / TableColumnHeaderItem 只能切换 0/1，
 * 但数据层（tableContent.headerRows）本来就是数字，多行表头是支持的，这里只是把入口放开。
 */
function HeaderPicker({
  label,
  kind,
  steps,
}: {
  label: string;
  kind: "headerRows" | "headerCols";
  steps: number[];
}) {
  const editor = useBlockNoteEditor();
  const block = useHoveredTable();
  // 悬停快照不会随内容更新，点完自己记一份，否则高亮停在旧值上
  const [current, setCurrent] = useState(() =>
    block && block.type === "table" ? Number(block.content[kind] ?? 0) || 0 : 0,
  );
  if (!block || block.type !== "table") return null;
  return (
    <div className={s.headerRow}>
      <span className={s.headerLabel}>{label}</span>
      <span className={s.headerBtns}>
        {steps.map((n) => (
          <button
            key={n}
            type="button"
            role="menuitemradio"
            aria-checked={current === n}
            className={n === current ? `${s.headerBtn} ${s.headerOn}` : s.headerBtn}
            onClick={() => {
              setCurrent(n);
              const next: TableContent = { ...block.content, [kind]: n };
              updateContent(editor, block, next);
            }}
          >
            {n === 0 ? "无" : n}
          </button>
        ))}
      </span>
    </div>
  );
}

/** 自定义拖拽菜单：默认项（颜色 / 表头切换 / 删除）之外，补表格的行列操作 */
const TableDragHandleMenu: FC = () => {
  const block = useHoveredTable();
  const isTable = block?.type === "table";
  return (
    <DragHandleMenu>
      {isTable && (
        <>
          <AddRowItem />
          <AddColumnItem />
          <span className={s.sep} />
        </>
      )}
      <BlockColorsItem>颜色</BlockColorsItem>
      {isTable && (
        <>
          <HeaderPicker label="表头行" kind="headerRows" steps={HEADER_STEPS} />
          <HeaderPicker label="表头列" kind="headerCols" steps={HEADER_STEPS} />
        </>
      )}
      <RemoveBlockItem>删除</RemoveBlockItem>
    </DragHandleMenu>
  );
};

/**
 * 替换 BlockNote 默认的左侧侧栏：按钮不变，只是拖拽菜单里多出「表格」一组。
 * 用法：<BlockNoteView sideMenu={false}> 里放 <SideMenuController sideMenu={TableSideMenu} />
 */
export const TableSideMenu: FC<SideMenuProps> = (props) => (
  <SideMenu {...props}>
    <AddBlockButton />
    <DragHandleButton {...props} dragHandleMenu={TableDragHandleMenu} />
  </SideMenu>
);
