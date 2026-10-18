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
