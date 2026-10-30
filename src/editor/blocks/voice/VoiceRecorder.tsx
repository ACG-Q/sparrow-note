import { useEffect, useRef, useState } from "react";
import { audioWaveform, blobToDataURL, checkAudioFile, fileToDataURL, packWave } from "../../../lib/media";
import shared from "../_shared/blockCommon.module.css";
import { stopMouseDown } from "../_shared/BlockShell";
import { AudioPlayer } from "../_shared/AudioPlayer";
import s from "./styles.module.css";
import type { VoiceBlockT, VoiceEditor } from "./config";

const BAR_COUNT = 44;

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
  const [levels, setLevels] = useState<number[]>([]);
  const [err, setErr] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const discardRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(
    () => () => {
      window.clearInterval(timerRef.current);
      window.cancelAnimationFrame(rafRef.current);
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
      void audioCtxRef.current?.close();
    },
    [],
  );

  /** 用 AnalyserNode 取实时音量，喂给波形条 */
  const startMeter = (stream: MediaStream) => {
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let last = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        if (now - last > 70) {
          last = now;
          setLevels((prev) => [...prev.slice(-(BAR_COUNT - 1)), Math.min(1, rms * 3.2)]);
        }
        rafRef.current = window.requestAnimationFrame(tick);
      };
      rafRef.current = window.requestAnimationFrame(tick);
    } catch {
      /* 取不到波形不影响录音 */
    }
  };

  const stopMeter = () => {
    window.cancelAnimationFrame(rafRef.current);
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
  };

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
        stopMeter();
        if (discardRef.current) return;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        void blobToDataURL(blob).then(async (url) => {
          // 落库前先算一次静态波形，阅读态就能画成播客那样的条
          let wave = "";
          try {
            wave = packWave(await audioWaveform(blob));
          } catch {
            wave = "";
          }
          editor.updateBlock(block, { props: { url, wave } });
        });
      };
      rec.start();
      recRef.current = rec;
      setLevels([]);
      setSecs(0);
      setErr("");
      setRecording(true);
      startMeter(stream);
      timerRef.current = window.setInterval(() => setSecs((x) => x + 1), 1000);
    } catch {
      setErr("没拿到麦克风权限，或这台设备没有麦克风。");
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
    stopMeter();
    setRecording(false);
    setLevels([]);
    setSecs(0);
    onCancel();
  };

  const pickFile = async (file: File) => {
    const check = checkAudioFile(file);
    if (!check.ok) {
      setErr(check.error);
      return;
    }
    setErr("");
    const url = await fileToDataURL(file);
    let wave = "";
    try {
      wave = packWave(await audioWaveform(file));
    } catch {
      wave = "";
    }
    editor.updateBlock(block, { props: { url, wave } });
  };

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  const hasTake = Boolean(block.props.url);

  return (
    <div className={s.recorder} contentEditable={false}>
      <div className={s.recStage}>
        <button
          type="button"
          className={recording ? `${s.recKey} ${s.recKeyOn}` : s.recKey}
          onMouseDown={stopMouseDown}
          onClick={recording ? stop : start}
          aria-label={recording ? "停止录音" : "开始录音"}
        >
          <span className={recording ? s.recSquare : s.recDot} />
        </button>

        <div className={s.recInfo}>
          <span className={s.recTime}>{mmss}</span>
          <span className={s.recState}>
            {recording ? "正在录音" : hasTake ? "已有一段录音" : "点左侧开始"}
          </span>
        </div>

        <div className={s.wave} aria-hidden="true">
          {Array.from({ length: BAR_COUNT }).map((_, i) => {
            const v = levels[i] ?? 0;
            const idle = recording ? 0.06 : 0.03;
            return (
              <i
                key={i}
                className={recording ? `${s.waveBar} ${s.waveBarOn}` : s.waveBar}
                style={{ height: `${Math.max(idle, v) * 100}%` }}
              />
            );
          })}
        </div>
      </div>

      {err && <div className={s.recErr}>{err}</div>}

      {!recording && hasTake && (
        <div className={s.recPreview}>
          <AudioPlayer src={block.props.url} label="语音" wave={block.props.wave} />
        </div>
      )}

      <div className={s.recActions}>
        <button
          type="button"
          className={s.recGhost}
          onMouseDown={stopMouseDown}
          onClick={() => fileRef.current?.click()}
        >
          导入音频
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void pickFile(f);
          }}
        />
        {recording ? (
          <button type="button" className={s.recGhost} onMouseDown={stopMouseDown} onClick={cancel}>
            取消这一段
          </button>
        ) : (
          <>
            {hasTake && (
              <button
                type="button"
                className={s.recGhost}
                onMouseDown={stopMouseDown}
                onClick={() => void start()}
              >
                重录
              </button>
            )}
            <button type="button" className={shared.done} onMouseDown={stopMouseDown} onClick={onDone}>
              完成
            </button>
          </>
        )}
      </div>
    </div>
  );
}
