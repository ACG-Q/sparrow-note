import { EMOJIS } from "./config";
import s from "./styles.module.css";

export default function MoodEdit({ emoji, onPick }: { emoji: string; onPick: (e: string) => void }) {
  return (
    <div className={s.picker} contentEditable={false}>
      {EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          className={e === emoji ? `${s.pickerBtn} ${s.pickerActive}` : s.pickerBtn}
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={() => onPick(e)}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
