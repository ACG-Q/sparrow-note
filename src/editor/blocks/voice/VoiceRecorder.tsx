import { useEffect, useRef, useState } from "react";
import { blobToDataURL } from "../../../lib/media";
import shared from "../_shared/blockCommon.module.css";
import { stopMouseDown } from "../_shared/BlockShell";
import s from "./styles.module.css";
import type { VoiceBlockT, VoiceEditor } from "./config";

export default function VoiceRecorder({
  block,
  editor,
  onDone,
  onCancel,
}: {
  block: VoiceBlockT;
  editor: VoiceEditor;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const discardRef = useRef(false);

  useEffect(
    () => () => {
      window.clearInterval(timerRef.current);
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      discardRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (discardRef.current) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        blobToDataURL(blob).then((url) => {
          editor.updateBlock(block, { props: { url } });
          onDone();
        });
      };
      rec.start();
      recRef.current = rec;
      setSecs(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setSecs((x) => x + 1), 1000);
    } catch {
      setRecording(false);
    }
  };

  const stop = () => {
    window.clearInterval(timerRef.current);
    recRef.current?.stop();
    setRecording(false);
  };

  const cancel = () => {
    discardRef.current = true;
    window.clearInterval(timerRef.current);
    recRef.current?.stop();
    setRecording(false);
    onCancel();
  };

  return (
    <div className={shared.form} contentEditable={false}>
      <div className={s.recHead}>
        <span className={s.timer}>
          {recording ? `录音中 ${secs}s` : block.props.url ? "点击「重新录制」覆盖当前录音" : "点击「开始录音」开始"}
        </span>
        {recording && <span className={s.recDot} />}
      </div>
      <div className={shared.formRow}>
        <button
          type="button"
          className={s.btn}
          onMouseDown={stopMouseDown}
          onClick={recording ? stop : start}
        >
          {recording ? "停止" : block.props.url ? "重新录制" : "开始录音"}
        </button>
        <button type="button" className={s.cancelBtn} onMouseDown={stopMouseDown} onClick={cancel}>
          取消
        </button>
        {!recording && (
          <button type="button" className={shared.done} onMouseDown={stopMouseDown} onClick={onDone}>
            完成
          </button>
        )}
      </div>
    </div>
  );
}
