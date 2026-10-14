import { createReactBlockSpec, ReactCustomBlockRenderProps } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useEffect, useRef, useState } from "react";

const EMOJIS = ["😀", "😄", "😐", "😢", "😡", "🥰", "😴", "🤯", "😎", "😭", "🤒", "🥳"];

const moodConfig = {
  type: "mood",
  propSchema: {
    ...defaultProps,
    emoji: { default: "🙂" },
  },
  content: "inline",
} as const;

type MoodProps = ReactCustomBlockRenderProps<typeof moodConfig>;

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
    <div className="bn-mood" ref={rootRef}>
      <button
        type="button"
        className="bn-mood-emoji"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-label="选择心情"
      >
        {block.props.emoji}
      </button>
      {open && (
        <div className="bn-mood-picker" contentEditable={false}>
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => {
                editor.updateBlock(block, { props: { emoji: e } });
                setOpen(false);
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <div className="bn-mood-note" ref={contentRef} />
    </div>
  );
}

export const MoodBlock = createReactBlockSpec(moodConfig, {
  render: (props) => <MoodRender {...props} />,
});
