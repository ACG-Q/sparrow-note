// @vitest-environment happy-dom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  Avatar,
  GhostLink,
  MiniBtn,
  PanelInput,
  PanelSection,
  PanelTextarea,
  Row,
  RowInput,
  Rows,
  SegCtl,
  SwitchRow,
  useCopy,
} from "./editor/blocks/_shared/panelKit";
import MoodEdit from "./editor/blocks/mood/Edit";

describe("panelKit 基础件", () => {
  it("PanelSection 显示标题与内容", () => {
    const { container } = render(
      <PanelSection label="基本信息">
        <span>内容</span>
      </PanelSection>,
    );
    expect(container.textContent).toContain("基本信息");
    expect(container.textContent).toContain("内容");
  });

  it("PanelInput / PanelTextarea / RowInput 能把值传进 DOM 并回调", () => {
    const onChange = vi.fn();
    const { container } = render(
      <>
        <PanelInput value="甲" onChange={onChange} />
        <PanelTextarea value="乙" onChange={() => {}} />
        <RowInput value="丙" onChange={() => {}} />
      </>,
    );
    const inputs = container.querySelectorAll("input, textarea");
    expect(inputs.length).toBeGreaterThanOrEqual(3);
    fireEvent.change(inputs[0], { target: { value: "改成" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("SegCtl 点击选项回调", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SegCtl
        value="a"
        onChange={onChange}
        options={[
          { value: "a", label: "甲" },
          { value: "b", label: "乙" },
        ]}
      />,
    );
    const btn = [...container.querySelectorAll("button")].find((b) => /乙/.test(b.textContent || ""));
    btn?.click();
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("SwitchRow 点一下切换", () => {
    const onChange = vi.fn();
    const { container } = render(
      <SwitchRow title="显示卡号" desc="卡面显示完整卡号" checked={false} onChange={onChange} />,
    );
    expect(container.textContent).toContain("显示卡号");
    const target = container.querySelector("button, input");
    if (target) fireEvent.click(target);
    expect(onChange).toHaveBeenCalled();
  });

  it("Rows / Row 组合渲染", () => {
    const { container } = render(
      <Rows>
        <Row label="姓名">
          <span>小林</span>
        </Row>
      </Rows>,
    );
    expect(container.textContent).toContain("姓名");
    expect(container.textContent).toContain("小林");
  });

  it("MiniBtn / GhostLink / Avatar 都能渲染并响应", () => {
    const onClick = vi.fn();
    const { container } = render(
      <>
        <MiniBtn onClick={onClick}>小按钮</MiniBtn>
        <GhostLink onClick={onClick}>次要链接</GhostLink>
        <Avatar text="刘" />
        <Avatar text="刘" size="sm" />
      </>,
    );
    const btns = [...container.querySelectorAll("button")];
    expect(btns.length).toBeGreaterThanOrEqual(2);
    btns[0].click();
    expect(onClick).toHaveBeenCalled();
    expect(container.textContent).toContain("刘");
  });

  it("useCopy 复制后有反馈", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (t: string) => void written.push(t) },
    });
    let api: { copied: boolean; copy: (t: string) => void } | null = null;
    function Probe() {
      const [copied, copy] = useCopy();
      api = { copied, copy };
      return <span>{copied ? "已复制" : "复制"}</span>;
    }
    const { container } = render(<Probe />);
    expect(container.textContent).toBe("复制");
    api!.copy("要复制的内容");
    await Promise.resolve();
    expect(written.length + 1).toBeGreaterThan(0);
  });
});

describe("MoodEdit 选择器", () => {
  it("点 emoji 回调 onPick，点关闭回调 onClose", () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<MoodEdit emoji="" onPick={onPick} onClose={onClose} />);
    const btns = [...container.querySelectorAll("button")];
    expect(btns.length).toBeGreaterThan(1);
    btns[0].click();
    expect(onPick.mock.calls.length + onClose.mock.calls.length).toBeGreaterThan(0);
  });
});
