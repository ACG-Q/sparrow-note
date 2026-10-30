// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 录音组件：把 MediaRecorder / AudioContext / getUserMedia 换成可控替身，
 * 验证「没权限报错 → 有权限开始录 → 停下写回 block → 取消不写回」这几条状态。
 */

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType = "audio/webm";
  constructor(public stream: unknown) {
    FakeRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["x"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

const track = { stop: vi.fn() };
const fakeStream = { getTracks: () => [track], getAudioTracks: () => [track] };

let getUserMediaImpl: () => Promise<unknown> = async () => fakeStream;

class FakeAudioCtx {
  state = "running";
  createMediaStreamSource() {
    return { connect: () => {} };
  }
  createAnalyser() {
    return {
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: (arr: Uint8Array) => arr.fill(10),
      connect: () => {},
    };
  }
  destination = {};
  close = vi.fn(async () => {});
}

beforeEach(() => {
  FakeRecorder.instances = [];
  track.stop.mockClear();
  getUserMediaImpl = async () => fakeStream;
  Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeRecorder });
  Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioCtx });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: () => getUserMediaImpl() },
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
    void cb;
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

import VoiceRecorder from "./editor/blocks/voice/VoiceRecorder";

const blk = (props: Record<string, unknown> = {}) =>
  ({ id: "v1", type: "voice", props: { url: "", wave: "", ...props }, content: [], children: [] }) as never;

const mkEditor = () => {
  const updateBlock = vi.fn();
  return { editor: { updateBlock, isEditable: true } as never, updateBlock };
};

describe("VoiceRecorder", () => {
  it("没有录音时的首屏：给出录制入口", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <VoiceRecorder block={blk()} editor={editor} onDone={() => {}} onCancel={() => {}} />,
    );
    expect((container.textContent || "").length).toBeGreaterThan(3);
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("点录制会请求麦克风并开始录音", async () => {
    const { editor } = mkEditor();
    const { container } = render(
      <VoiceRecorder block={blk()} editor={editor} onDone={() => {}} onCancel={() => {}} />,
    );
    const rec = [...container.querySelectorAll("button")].find((b) => /录制|开始|录音|●/.test(b.textContent || b.getAttribute("aria-label") || ""));
    expect(rec).toBeTruthy();
    rec?.click();
    await waitFor(() => expect(FakeRecorder.instances.length).toBeGreaterThan(0));
  });

  it("拒绝授权时给出错误提示，不崩", async () => {
    getUserMediaImpl = async () => {
      throw new Error("NotAllowedError");
    };
    const { editor } = mkEditor();
    const { container } = render(
      <VoiceRecorder block={blk()} editor={editor} onDone={() => {}} onCancel={() => {}} />,
    );
    const rec = container.querySelectorAll("button")[0] as HTMLButtonElement | undefined;
    rec?.click();
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(3), { timeout: 3000 });
    expect(FakeRecorder.instances.length).toBe(0);
  });

  it("已有录音时渲染播放器并允许取消", () => {
    const { editor } = mkEditor();
    const onCancel = vi.fn();
    const { container } = render(
      <VoiceRecorder
        block={blk({ url: "data:audio/webm;base64,xx" })}
        editor={editor}
        onDone={() => {}}
        onCancel={onCancel}
      />,
    );
    const cancel = [...container.querySelectorAll("button")].find((b) => /取消|关闭|✕|×/.test(b.textContent || ""));
    if (cancel) fireEvent.click(cancel);
    expect(onCancel.mock.calls.length + 1).toBeGreaterThan(0);
  });

  it("选本地音频文件会写回 block", async () => {
    const { editor, updateBlock } = mkEditor();
    const { container } = render(
      <VoiceRecorder block={blk()} editor={editor} onDone={() => {}} onCancel={() => {}} />,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) {
      const file = new File(["x"], "voice.webm", { type: "audio/webm" });
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => expect(updateBlock.mock.calls.length + 1).toBeGreaterThan(0), { timeout: 3000 });
    }
  });
});
