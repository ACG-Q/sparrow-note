import { moodChar } from "../../../lib/mood";
import { EMOJIS } from "./config";
import s from "./styles.module.css";

export default function MoodEdit({
  emoji,
  onPick,
  onClose,
}: {
  emoji: string;
  onPick: (e: string) => void;
  onClose: () => void;
}) {
  return (
    <div className={s.pickerWrap} contentEditable={false}>
      <div className={s.pickerHead}>
        <span className={s.pickerTitle}>此刻心情</span>
        <span className={s.pickerNow}>{emoji ? moodChar(emoji) : "—"}</span>
        <button
          type="button"
          className={s.pickerClose}
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={onClose}
          aria-label="关闭"
        >
          ✕
        </button>
      </div>
      <div className={s.picker}>
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            className={e === emoji ? `${s.pickerBtn} ${s.pickerActive}` : s.pickerBtn}
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => onPick(e)}
            aria-label={moodChar(e)}
          >
            {moodChar(e)}
          </button>
        ))}
      </div>
      <p className={s.pickerHint}>选一个字，作为这一篇的心情</p>
    </div>
  );
}
