import { describe, expect, it } from "vitest";
import { MAX_AUDIO_BYTES, checkAudioFile } from "./media";

describe("checkAudioFile", () => {
  it("通过合法的小音频文件", () => {
    const file = { name: "a.mp3", size: 1024, type: "audio/mpeg" };
    expect(checkAudioFile(file)).toEqual({ ok: true });
  });

  it("拒绝超过 20MB 的文件", () => {
    const file = { name: "big.wav", size: MAX_AUDIO_BYTES + 1, type: "audio/wav" };
    expect(checkAudioFile(file)).toEqual({ ok: false, error: "音频文件不能超过 20MB" });
  });

  it("拒绝非音频类型", () => {
    const file = { name: "a.png", size: 100, type: "image/png" };
    expect(checkAudioFile(file)).toEqual({ ok: false, error: "请选择音频文件" });
  });

  it("恰好 20MB 放行", () => {
    const file = { name: "edge.mp3", size: MAX_AUDIO_BYTES, type: "audio/mpeg" };
    expect(checkAudioFile(file)).toEqual({ ok: true });
  });
});
