import { forwardRef } from "react";
import { moodChar } from "../../../lib/mood";
import s from "./styles.module.css";

export default forwardRef<
  HTMLDivElement,
  {
    emoji: string;
    onTogglePicker: () => void;
  }
>(function MoodDisplay({ emoji, onTogglePicker }, contentRef) {
  return (
    <div className={s.row}>
      <button
        type="button"
        className={s.emoji}
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onTogglePicker}
        aria-label="选择心情"
      >
        {moodChar(emoji)}
      </button>
      <div className={s.note} ref={contentRef} />
    </div>
  );
});
