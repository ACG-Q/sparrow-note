import { useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon, TrashIcon } from "../../icons";
import { ActionBtn, BlockCard } from "../_shared/BlockShell";
import { FloatingPanel } from "../_shared/FloatingPanel";
import { checklistConfig, parseItems, type ChecklistProps } from "./config";
import ChecklistDisplay from "./Display";
import ChecklistEdit from "./Edit";

function ChecklistRender({ block, editor }: ChecklistProps) {
  const [editing, setEditing] = useState(() => parseItems(block.props.items).length === 0);
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} style={{ width: "100%" }}>
      <BlockCard
        active={editing}
        onClick={() => setEditing(true)}
        actions={
          <>
            <ActionBtn icon={<PencilIcon />} label="编辑清单" onClick={() => setEditing(true)} />
            <ActionBtn
              icon={<TrashIcon />}
              label="删除清单"
              danger
              onClick={() => editor.removeBlocks([block])}
            />
          </>
        }
      >
        <ChecklistDisplay block={block} editor={editor} />
      </BlockCard>
      {editing && (
        <FloatingPanel anchor={rootRef.current} width={360} onClose={() => setEditing(false)}>
          <ChecklistEdit block={block} editor={editor} onDone={() => setEditing(false)} />
        </FloatingPanel>
      )}
    </div>
  );
}

export const ChecklistBlock = createReactBlockSpec(checklistConfig, {
  render: (props) => <ChecklistRender {...props} />,
});
