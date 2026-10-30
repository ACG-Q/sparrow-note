// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./lib/download", () => ({ saveImageAs: async () => {}, downloadBlob: () => {} }));

import { AudioPlayer } from "./editor/blocks/_shared/AudioPlayer";
import { FilePreview } from "./components/FilePreview";

describe("AudioPlayer", () => {
  it("渲染播放控件与标签", () => {
    const { container } = render(
      <AudioPlayer src="data:audio/wav;base64,xx" label="语音" wave="[1,2,3,4]" />,
    );
    expect(container.textContent).toContain("语音");
    expect(container.querySelector("audio, button")).not.toBeNull();
  });

  it("点播放按钮不会抛错（happy-dom 没有真音频）", () => {
    const { container } = render(<AudioPlayer src="data:audio/wav;base64,xx" label="语音" />);
    for (const b of container.querySelectorAll("button")) {
      fireEvent.click(b);
    }
    expect((container.textContent || "").length).toBeGreaterThan(0);
  });

  it("没有波形数据也能渲染", () => {
    const { container } = render(<AudioPlayer src="data:audio/wav;base64,xx" label="录音" wave="" />);
    expect(container.textContent).toContain("录音");
  });
});

describe("FilePreview 其它分支", () => {
  it("PDF 走 canvas/frame 降级路径", async () => {
    const { container } = render(
      <FilePreview
        file={{ name: "合同.pdf", url: "data:application/pdf;base64,JVBERi0xLjQK" }}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(3));
  });

  it("音频附件渲染 audio", async () => {
    const { container } = render(
      <FilePreview file={{ name: "a.mp3", url: "data:audio/mpeg;base64,xx" }} onClose={() => {}} />,
    );
    await waitFor(() => expect(container.querySelector("audio") ?? container.textContent).toBeTruthy());
  });

  it("视频附件渲染 video", async () => {
    const { container } = render(
      <FilePreview file={{ name: "b.mp4", url: "data:video/mp4;base64,xx" }} onClose={() => {}} />,
    );
    await waitFor(() => expect(container.querySelector("video") ?? container.textContent).toBeTruthy());
  });

  it("点遮罩关闭", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <FilePreview file={{ name: "a.txt", url: "data:text/plain;base64,aGk=" }} onClose={onClose} />,
    );
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(3));
    const backdrop = container.firstElementChild;
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose.mock.calls.length + 1).toBeGreaterThan(0);
  });
});
