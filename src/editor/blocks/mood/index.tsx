import { useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon, TrashIcon } from "../../icons";
import { ActionBtn, BlockCard } from "../_shared/BlockShell";
import { FloatingPanel } from "../_shared/FloatingPanel";
import { moodConfig, type MoodProps } from "./config";
import MoodDisplay from "./Display";
import MoodEdit from "./Edit";

function MoodRender({ block, editor, contentRef }: MoodProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} style={{ width: "100%" }}>
      <BlockCard
        active={open}
        onClick={() => setOpen(true)}
        actions={
          <>
            <ActionBtn icon={<PencilIcon />} label="编辑心情" onClick={() => setOpen(true)} />
            <ActionBtn
              icon={<TrashIcon />}
              label="删除心情"
              danger
              onClick={() => editor.removeBlocks([block])}
            />
          </>
        }
      >
        <MoodDisplay
          emoji={block.props.emoji}
          ref={contentRef}
          onTogglePicker={() => setOpen((v) => !v)}
        />
      </BlockCard>
      {open && (
        <FloatingPanel anchor={rootRef.current} width={244} onClose={() => setOpen(false)}>
          <MoodEdit
            emoji={block.props.emoji}
            onClose={() => setOpen(false)}
            onPick={(e) => {
              editor.updateBlock(block, { props: { emoji: e } });
              setOpen(false);
            }}
          />
        </FloatingPanel>
      )}
    </div>
  );
}

export const MoodBlock = createReactBlockSpec(moodConfig, {
  render: (props) => <MoodRender {...props} />,
});
