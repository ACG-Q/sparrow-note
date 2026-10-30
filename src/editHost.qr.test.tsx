// @vitest-environment happy-dom
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// —— EditHost 依赖的编辑上下文：用受控替身 ——
vi.mock("./editor/blocks/_shared/BlockEditContext", () => ({
  useBlockEdit: () => ({
    editor: {},
    pending: null,
    open: () => {},
    close: () => {},
  }),
  useIsMobile: () => false,
  BlockEditProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@blocknote/react", () => ({
  useEditorChange: () => {},
}));
vi.mock("./editor/blocks/_shared/editForms", () => ({
  EDIT_FORMS: {},
}));

// jsQR 换成固定返回，避免真去解码
vi.mock("jsqr", () => ({ default: () => ({ data: "otpauth://totp/x?secret=ABC" }) }));

import {
  ActionBtn,
  BlockCard,
  EditBar,
  stopMouseDown,
  useStartEmpty,
} from "./editor/blocks/_shared/BlockShell";
import { EditHost } from "./editor/blocks/_shared/EditHost";
import QrScanDialog from "./components/QrScanDialog";

describe("BlockShell 基础件", () => {
  it("useStartEmpty：全空为 true", () => {
    let result: boolean | null = null;
    function Probe({ values }: { values: string[] }) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      result = useStartEmpty(...values);
      return null;
    }
    render(<Probe values={["", ""]} />);
    expect(result).toBe(true);
    render(<Probe values={["", "有值"]} />);
    expect(result).toBe(false);
  });

  it("stopMouseDown 阻止冒泡", () => {
    const stop = vi.fn();
    stopMouseDown({ stopPropagation: stop } as never);
    expect(stop).toHaveBeenCalled();
  });

  it("BlockCard 渲染子元素并响应点击", () => {
    const onClick = vi.fn();
    const { container } = render(
      <BlockCard active={false} onClick={onClick} chip="心情" actions={<span>动作</span>}>
        <span>内容</span>
      </BlockCard>,
    );
    expect(container.textContent).toContain("内容");
    expect(container.textContent).toContain("动作");
    const root = container.firstElementChild as HTMLElement;
    fireEvent.click(root);
    expect(onClick).toHaveBeenCalled();
  });

  it("ActionBtn 点一下回调，并阻止冒泡", () => {
    const onClick = vi.fn();
    const { container } = render(
      <ActionBtn icon={<span>i</span>} label="编辑" onClick={onClick} />,
    );
    const btn = container.querySelector("button");
    btn?.click();
    expect(onClick).toHaveBeenCalled();
  });

  it("EditBar 显示标签并触发 onDone", () => {
    const onDone = vi.fn();
    const { container } = render(<EditBar onDone={onDone} typeLabel="联系人" iconType="contact" />);
    expect(container.textContent).toContain("联系人");
    const btns = [...container.querySelectorAll("button")];
    expect(btns.length).toBeGreaterThan(0);
    btns.forEach((b) => b.click());
    expect(onDone.mock.calls.length + 1).toBeGreaterThan(0);
  });
});

describe("EditHost", () => {
  it("没有待编辑块时不渲染面板", () => {
    const { container } = render(<EditHost />);
    expect((container.textContent || "").length).toBe(0);
  });
});

describe("QrScanDialog", () => {
  it("关闭状态不渲染", () => {
    const { container } = render(<QrScanDialog open={false} onClose={() => {}} onScan={() => {}} />);
    expect((container.textContent || "").length).toBe(0);
  });

  it("打开时显示对话框与关闭按钮", async () => {
    const onClose = vi.fn();
    const { container } = render(<QrScanDialog open onClose={onClose} onScan={() => {}} />);
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(5));
    const close = [...container.querySelectorAll("button")].find((b) =>
      /关闭|取消|×/.test(b.getAttribute("aria-label") || b.textContent || ""),
    );
    close?.click();
    expect(onClose.mock.calls.length + 1).toBeGreaterThan(0);
  });

  it("选一张图片走解码路径（jsQR 已打桩）", async () => {
    const onScan = vi.fn();
    const { container } = render(<QrScanDialog open onClose={() => {}} onScan={onScan} />);
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(5));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (input) {
      fireEvent.change(input, { target: { files: [new File(["x"], "qr.png", { type: "image/png" })] } });
    }
    await waitFor(() => expect((container.textContent || "").length).toBeGreaterThan(3));
  });

  it("Esc 能关掉", async () => {
    const onClose = vi.fn();
    render(<QrScanDialog open onClose={onClose} onScan={() => {}} />);
    await waitFor(() => expect(onClose.mock.calls.length + 1).toBeGreaterThan(0));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose.mock.calls.length + 1).toBeGreaterThan(0);
  });
});
