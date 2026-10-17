import { useEffect, useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { BlockIcon, PencilIcon } from "../../icons";
import { ActionBtn, BlockCard } from "../_shared/BlockShell";
import { checklistConfig, parseItems, type ChecklistProps } from "./config";
import ChecklistDisplay from "./Display";
import ChecklistEdit from "./Edit";

function ChecklistRender({ block, editor }: ChecklistProps) {
  const [editing, setEditing] = useState(() => parseItems(block.props.items).length === 0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setEditing(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [editing]);

  return (
    <div ref={rootRef} style={{ width: "100%" }}>
      <BlockCard
        chip={<BlockIcon type="checklist" />}
        active={editing}
        onClick={() => setEditing(true)}
        actions={<ActionBtn icon={<PencilIcon />} label="编辑清单" onClick={() => setEditing(true)} />}
      >
        {editing ? (
          <ChecklistEdit
            block={block}
            editor={editor}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <ChecklistDisplay block={block} editor={editor} />
        )}
      </BlockCard>
    </div>
  );
}

export const ChecklistBlock = createReactBlockSpec(checklistConfig, {
  render: (props) => <ChecklistRender {...props} />,
});
