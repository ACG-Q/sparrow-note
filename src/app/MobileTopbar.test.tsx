// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileTopbar } from "./MobileTopbar";

const base = {
  active: { id: "n1" },
  title: "秋日骑行",
  readMode: true,
  menuOpen: false,
  onBack: () => {},
  onOpenDrawer: () => {},
  onToggleRead: () => {},
  onToggleMenu: () => {},
  onCloseMenu: () => {},
  onOpenDatePicker: () => {},
  onDelete: () => {},
  onShareMd: () => {},
  onSharePdf: () => {},
};

describe("MobileTopbar", () => {
  it("渲染标题与三个固定按钮", () => {
    const { container } = render(<MobileTopbar {...base} />);
    expect(container.textContent).toContain("秋日骑行");
    expect(container.querySelector('[aria-label="返回"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="菜单"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="更多操作"]')).not.toBeNull();
  });

  it("阅读态显示「编辑」，编辑态显示「阅读」", () => {
    const read = render(<MobileTopbar {...base} readMode />);
    expect(read.container.textContent).toContain("编辑");
    read.unmount();

    const edit = render(<MobileTopbar {...base} readMode={false} />);
    expect(edit.container.textContent).toContain("阅读");
  });

  it("menuOpen=false 时没有菜单项", () => {
    const { container } = render(<MobileTopbar {...base} />);
    expect(container.textContent).not.toContain("删除笔记");
  });

  it("menuOpen=true 且编辑态：有「改日期」「分享项」「删除笔记」", () => {
    const { container } = render(<MobileTopbar {...base} readMode={false} menuOpen />);
    const text = container.textContent ?? "";
    expect(text).toContain("改日期");
    expect(text).toContain("删除笔记");
    // 分享项由 ShareMenuItems 提供，至少要有 PDF
    expect(text).toMatch(/PDF/);
  });

  it("阅读态不显示「改日期」（只有编辑态能改日期）", () => {
    const { container } = render(<MobileTopbar {...base} readMode menuOpen />);
    expect(container.textContent).not.toContain("改日期");
  });

  it("点删除会带上笔记 id 并关菜单", () => {
    const onDelete = vi.fn();
    const onCloseMenu = vi.fn();
    const { container } = render(
      <MobileTopbar {...base} readMode={false} menuOpen onDelete={onDelete} onCloseMenu={onCloseMenu} />,
    );
    const btn = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("删除笔记"),
    );
    expect(btn).toBeTruthy();
    btn?.click();
    expect(onDelete).toHaveBeenCalledWith("n1");
    expect(onCloseMenu).toHaveBeenCalled();
  });

  it("点 ⋯ 回调 onToggleMenu", () => {
    const onToggleMenu = vi.fn();
    const { container } = render(<MobileTopbar {...base} onToggleMenu={onToggleMenu} />);
    container.querySelector<HTMLButtonElement>('[aria-label="更多操作"]')?.click();
    expect(onToggleMenu).toHaveBeenCalled();
  });

  it("没有选中笔记时不显示删除与分享", () => {
    const { container } = render(<MobileTopbar {...base} active={null} readMode={false} menuOpen />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("删除笔记");
    expect(text).not.toMatch(/PDF/);
  });
});
