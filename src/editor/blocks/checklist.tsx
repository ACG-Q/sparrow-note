import { createReactBlockSpec, ReactCustomBlockRenderProps } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";

interface ChecklistItem {
  t: string;
  d: boolean;
}

function parseItems(raw: string): ChecklistItem[] {
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x): x is ChecklistItem =>
        !!x && typeof x === "object" && typeof x.t === "string" && typeof x.d === "boolean",
    );
  } catch {
    return [];
  }
}

const checklistConfig = {
  type: "checklist",
  propSchema: {
    ...defaultProps,
    items: { default: "[]" },
  },
  content: "none",
} as const;

type ChecklistProps = ReactCustomBlockRenderProps<typeof checklistConfig>;

function ChecklistRender({ block, editor }: ChecklistProps) {
  const items = parseItems(block.props.items);
  const save = (next: ChecklistItem[]) => {
    editor.updateBlock(block, { props: { items: JSON.stringify(next) } });
  };
  return (
    <div className="bn-checklist">
      {items.length === 0 && (
        <div className="bn-checklist-empty">空清单，点击下方添加</div>
      )}
      {items.map((it, i) => (
        <div className="bn-checklist-row" key={i}>
          <input
            type="checkbox"
            checked={it.d}
            onChange={() => save(items.map((x, j) => (j === i ? { ...x, d: !x.d } : x)))}
            contentEditable={false}
          />
          <input
            className={it.d ? "bn-checklist-text done" : "bn-checklist-text"}
            placeholder="待办事项"
            value={it.t}
            onChange={(e) =>
              save(items.map((x, j) => (j === i ? { ...x, t: e.target.value } : x)))
            }
            onMouseDown={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="bn-checklist-del"
            contentEditable={false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => save(items.filter((_, j) => j !== i))}
            aria-label="删除该项"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="bn-checklist-add"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => save([...items, { t: "", d: false }])}
      >
        ＋ 添加一项
      </button>
    </div>
  );
}

export const ChecklistBlock = createReactBlockSpec(checklistConfig, {
  render: (props) => <ChecklistRender {...props} />,
});
