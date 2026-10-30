// @vitest-environment happy-dom
import { StrictMode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAutoEditOnEmpty } from "./useAutoEditOnEmpty";

function Probe({
  enabled,
  onOpen,
  onClose,
}: {
  enabled: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  useAutoEditOnEmpty(enabled, onOpen, onClose);
  return <div data-testid="probe" />;
}

describe("useAutoEditOnEmpty", () => {
  it("空块挂载时自动打开一次", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(<Probe enabled onOpen={onOpen} onClose={onClose} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("有内容的块不打开", () => {
    const onOpen = vi.fn();
    render(<Probe enabled={false} onOpen={onOpen} onClose={() => {}} />);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("卸载时关掉面板", () => {
    const onClose = vi.fn();
    const view = render(<Probe enabled onOpen={() => {}} onClose={onClose} />);
    view.unmount();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("StrictMode 双挂载后仍然打开（回归：加了「只跑一次」标记后曾经失效）", () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(
      <StrictMode>
        <Probe enabled onOpen={onOpen} onClose={onClose} />
      </StrictMode>,
    );
    // StrictMode 会跑两遍 effect：第一遍打开、清理时关掉、第二遍必须再打开
    expect(onOpen.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(onOpen.mock.calls.length).toBe(onClose.mock.calls.length + 1);
  });

  it("回调换了引用也不会重复打开", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<Probe enabled onOpen={onOpen} onClose={() => {}} />);
    rerender(<Probe enabled onOpen={vi.fn()} onClose={() => {}} />);
    rerender(<Probe enabled onOpen={vi.fn()} onClose={() => {}} />);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
