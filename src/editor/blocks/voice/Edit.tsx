import s from "./styles.module.css";

export default function VoiceEdit({ secs, onStop }: { secs: number; onStop: () => void }) {
  return (
    <div className={s.root} contentEditable={false}>
      <div className={s.recording}>
        <span className={s.dot} />
        录音中 {secs}s
      </div>
      <div className={s.actions}>
        <button type="button" className={`${s.btn} ${s.rec}`} onMouseDown={(e) => e.preventDefault()} onClick={onStop}>
          停止录制（{secs}s）
        </button>
      </div>
    </div>
  );
}
