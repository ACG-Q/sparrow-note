export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export type AudioCheck = { ok: true } | { ok: false; error: string };

export function checkAudioFile(file: { name: string; size: number; type: string }): AudioCheck {
  if (!file.type.startsWith("audio/")) {
    return { ok: false, error: "请选择音频文件" };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false, error: "音频文件不能超过 20MB" };
  }
  return { ok: true };
}

/**
 * 把音频降采样成固定根数的波形（0–1），存进块属性里当缩略图。
 * 用 AudioContext.decodeAudioData 拿 PCM，取每段峰值，短音频也能看清起伏。
 */
export async function audioWaveform(src: string | Blob, bars = 48): Promise<number[]> {
  const buf = src instanceof Blob ? await src.arrayBuffer() : await (await fetch(src)).arrayBuffer();
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const ch = audio.getChannelData(0);
    const per = Math.max(1, Math.floor(ch.length / bars));
    const out: number[] = [];
    let peak = 0;
    for (let i = 0; i < bars; i++) {
      let max = 0;
      const start = i * per;
      const end = Math.min(ch.length, start + per);
      for (let j = start; j < end; j++) {
        const v = Math.abs(ch[j]);
        if (v > max) max = v;
      }
      out.push(max);
      if (max > peak) peak = max;
    }
    // 归一化，静音段留一点点底，别出现全平
    const norm = peak > 0 ? out.map((v) => Math.min(1, v / peak)) : out;
    return norm.map((v) => Math.max(0.04, Math.round(v * 100) / 100));
  } finally {
    void ctx.close();
  }
}

/** 波形数组 → 紧凑字符串（"8,12,40,…"），存 block props 用 */
export function packWave(wave: number[]): string {
  return wave.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 100)).join(",");
}

export function unpackWave(raw: string, bars = 48): number[] {
  if (!raw) return [];
  const nums = raw
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return [];
  const scaled = nums.map((n) => Math.min(1, Math.max(0, n / 100)));
  if (scaled.length === bars) return scaled;
  // 长度不一致（旧数据/换了根数）时线性重采样
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const at = Math.min(scaled.length - 1, Math.round((i / bars) * scaled.length));
    out.push(scaled[at]);
  }
  return out;
}
