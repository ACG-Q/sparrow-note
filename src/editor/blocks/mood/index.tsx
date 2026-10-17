import { useEffect, useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { BlockIcon, PencilIcon } from "../../icons";
import { ActionBtn, BlockCard } from "../_shared/BlockShell";
import { moodConfig, type MoodProps } from "./config";
import MoodDisplay from "./Display";
import MoodEdit from "./Edit";

function MoodRender({ block, editor, contentRef }: MoodProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <BlockCard
        chip={<BlockIcon type="mood" />}
        active={open}
        onClick={() => {
          if (!open) setOpen(true);
        }}
        actions={<ActionBtn icon={<PencilIcon />} label="编辑心情" onClick={() => setOpen(true)} />}
      >
        <MoodDisplay
          emoji={block.props.emoji}
          ref={contentRef}
          onTogglePicker={() => setOpen((v) => !v)}
        />
      </BlockCard>
      {open && (
        <MoodEdit
          emoji={block.props.emoji}
          onPick={(e) => {
            editor.updateBlock(block, { props: { emoji: e } });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export const MoodBlock = createReactBlockSpec(moodConfig, {
  render: (props) => <MoodRender {...props} />,
});
