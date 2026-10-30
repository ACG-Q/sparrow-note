import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { unpackWave } from "../../../lib/media";
import s from "./AudioPlayer.module.css";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const rest = Math.floor(sec % 60);
  return `${m}:${String(rest).padStart(2, "0")}`;
}

/**
 * 纸面风格的音频条：播放/暂停 + 波形（有静态波形时）+ 进度 + 时长。
 * 原生 audio 只留作内核，界面全自己画。
 */
export function AudioPlayer({
  src,
  label,
  wave,
}: {
  src: string;
  label?: string;
  /** packWave() 存下来的静态波形；没有就退化成细进度条 */
  wave?: string;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  const bars = useMemo(() => unpackWave(wave ?? ""), [wave]);

  useEffect(() => {
    setPlaying(false);
    setCur(0);
    setDur(0);
  }, [src]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  };

  const seekTo = (el: HTMLAudioElement, clientX: number, node: HTMLElement) => {
    if (!dur) return;
    const rect = node.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    el.currentTime = ratio * dur;
    setCur(el.currentTime);
  };

  const seek = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    seekTo(el, e.clientX, e.currentTarget);
  };

  const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;

  return (
    <div className={s.wrap} contentEditable={false} onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={s.play}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-label={playing ? "暂停" : "播放"}
      >
        {playing ? "❙❙" : "▶"}
      </button>

      {bars.length > 0 ? (
        <div className={s.wave} onClick={seek} role="presentation">
          {bars.map((v, i) => {
            const at = (i / bars.length) * 100;
            const on = at <= pct;
            return (
              <i
                key={i}
                className={on ? `${s.bar} ${s.barOn}` : s.bar}
                style={{ height: `${Math.max(12, v * 100)}%` }}
              />
            );
          })}
        </div>
      ) : (
        <div className={s.track} onClick={seek} role="presentation">
          <i className={s.fill} style={{ width: `${pct}%` }} />
        </div>
      )}

      <span className={s.time}>
        {fmt(cur)} / {fmt(dur)}
      </span>
      {label ? <span className={s.label}>{label}</span> : null}
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
