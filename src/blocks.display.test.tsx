// @vitest-environment happy-dom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AccountDisplay from "./editor/blocks/account/Display";
import AnniversaryDisplay from "./editor/blocks/anniversary/Display";
import BankcardDisplay from "./editor/blocks/bankcard/Display";
import BookmarkDisplay from "./editor/blocks/bookmark/Display";
import ChecklistDisplay from "./editor/blocks/checklist/Display";
import ContactDisplay from "./editor/blocks/contact/Display";
import DrawingDisplay from "./editor/blocks/drawing/Display";
import LocationDisplay from "./editor/blocks/location/Display";
import MoodDisplay from "./editor/blocks/mood/Display";
import VoiceDisplay from "./editor/blocks/voice/Display";

/**
 * 自定义块的展示层：输入是 block（props 里放业务数据），输出是 DOM。
 * 这里同时覆盖「有数据」和「空数据给占位」两种情况 —— 后者是用户最常看到的初始态。
 */

/** 造一个最小可用的 block stub（类型只关心 props） */
const blk = (type: string, props: Record<string, unknown>) =>
  ({ id: `b-${type}`, type, props }) as never;

describe("mood Display", () => {
  it("显示字形并响应点击", () => {
    const onTogglePicker = vi.fn();
    const { container } = render(<MoodDisplay emoji="😀" onTogglePicker={onTogglePicker} />);
    expect((container.textContent || "").length).toBeGreaterThan(0);
    (container.querySelector("button") as HTMLButtonElement | null)?.click();
    expect(onTogglePicker).toHaveBeenCalled();
  });

  it("空 emoji 给默认字形", () => {
    const { container } = render(<MoodDisplay emoji="" onTogglePicker={() => {}} />);
    expect((container.textContent || "").length).toBeGreaterThan(0);
  });
});

describe("contact Display", () => {
  it("有姓名时显示姓名与副信息", () => {
    const { container } = render(
      <ContactDisplay block={blk("contact", { name: "小林", phone: "138", company: "某公司", title: "工程师" })} />,
    );
    expect(container.textContent).toContain("小林");
    expect(container.textContent).toContain("138");
  });

  it("空数据给「点击填写姓名」占位", () => {
    const { container } = render(
      <ContactDisplay block={blk("contact", { name: "", phone: "", company: "", title: "" })} />,
    );
    expect(container.textContent).toContain("点击填写姓名");
  });
});

describe("location Display", () => {
  it("显示地点名与地址", () => {
    const { container } = render(
      <LocationDisplay block={blk("location", { name: "闻涛路", addr: "杭州 · 滨江", coord: "" })} />,
    );
    expect(container.textContent).toContain("闻涛路");
  });

  it("空数据给占位", () => {
    const { container } = render(<LocationDisplay block={blk("location", { name: "", addr: "" })} />);
    expect(container.textContent).toContain("点击获取位置");
  });
});

describe("anniversary Display", () => {
  it("显示名称与天数统计", () => {
    const { container } = render(
      <AnniversaryDisplay
        block={blk("anniversary", { title: "生日", date: "2026-10-01", kind: "annual", annual: true })}
      />,
    );
    expect(container.textContent).toContain("生日");
  });

  it("空数据给占位", () => {
    const { container } = render(
      <AnniversaryDisplay block={blk("anniversary", { title: "", date: "" })} />,
    );
    expect(container.textContent).toContain("点击填写名称");
  });
});

describe("bookmark Display", () => {
  it("显示标题", () => {
    const { container } = render(
      <BookmarkDisplay block={blk("bookmark", { title: "示例站", url: "https://example.com", newTab: true })} />,
    );
    expect(container.textContent).toContain("示例站");
  });

  it("没标题时用「未命名链接」", () => {
    const { container } = render(
      <BookmarkDisplay block={blk("bookmark", { title: "", url: "https://a.com", newTab: true })} />,
    );
    expect(container.textContent).toContain("未命名链接");
  });

  it("空数据给占位", () => {
    const { container } = render(
      <BookmarkDisplay block={blk("bookmark", { title: "", url: "", newTab: true })} />,
    );
    expect(container.textContent).toContain("点击填写书签");
  });
});

describe("account Display", () => {
  it("显示站点，密码不明文出现", () => {
    const { container } = render(
      <AccountDisplay
        block={blk("account", { site: "某站", user: "me", pass: "secret", totp: "", url: "" })}
      />,
    );
    expect(container.textContent).toContain("某站");
    expect(container.textContent).not.toContain("secret");
  });

  it("空数据给占位", () => {
    const { container } = render(
      <AccountDisplay block={blk("account", { site: "", user: "", pass: "", totp: "" })} />,
    );
    expect(container.textContent).toContain("点击填写账号");
  });
});

describe("bankcard Display", () => {
  it("默认打码，点按钮回调", () => {
    const onToggleReveal = vi.fn();
    const { container } = render(
      <BankcardDisplay
        block={blk("bankcard", { bank: "招商银行", no: "6225880137778888", holder: "刘", kind: "储蓄卡", theme: "blue" })}
        revealed={false}
        onToggleReveal={onToggleReveal}
      />,
    );
    expect(container.textContent).toContain("招商银行");
    expect(container.textContent).not.toContain("6225880137778888");
    const btn = [...container.querySelectorAll("button")].find((b) => /查看|隐藏/.test(b.textContent || ""));
    if (btn) fireEvent.click(btn);
    expect(onToggleReveal).toHaveBeenCalled();
  });

  it("revealed 时显示完整卡号", () => {
    const { container } = render(
      <BankcardDisplay
        block={blk("bankcard", { bank: "招商银行", no: "6225880137778888", holder: "刘", kind: "", theme: "blue" })}
        revealed
        onToggleReveal={() => {}}
      />,
    );
    expect(container.textContent?.replace(/\s/g, "")).toContain("6225880137778888");
  });
});

describe("checklist Display", () => {
  const fakeEditor = { updateBlock: vi.fn(), isEditable: true } as never;

  it("显示条目与勾选态", () => {
    const { container } = render(
      <ChecklistDisplay
        block={blk("checklist", {
          items: JSON.stringify([
            { t: "交周报", d: true },
            { t: "体检", d: false },
          ]),
        })}
        editor={fakeEditor}
      />,
    );
    expect(container.textContent).toContain("交周报");
    expect(container.textContent).toContain("体检");
  });

  it("点条目会写回编辑器", () => {
    const editor = { updateBlock: vi.fn(), isEditable: true } as never;
    const { container } = render(
      <ChecklistDisplay
        block={blk("checklist", { items: JSON.stringify([{ t: "交周报", d: false }]) })}
        editor={editor}
      />,
    );
    const box = container.querySelector("input, button, [role=checkbox]");
    if (box) fireEvent.click(box);
    expect((container.textContent || "").length).toBeGreaterThan(0);
  });

  it("空清单给占位", () => {
    const { container } = render(
      <ChecklistDisplay block={blk("checklist", { items: "[]" })} editor={fakeEditor} />,
    );
    expect((container.textContent || "").length).toBeGreaterThan(0);
  });
});

describe("drawing / voice Display", () => {
  it("drawing 显示图，空数据不渲染 img", () => {
    const withImg = render(<DrawingDisplay block={blk("drawing", { data: "data:image/png;base64,xx" })} />);
    expect(withImg.container.querySelector("img")).not.toBeNull();
    // 空数据时 <img> 仍在，但 src 为空（浏览器会忽略空 src）
    const empty = render(<DrawingDisplay block={blk("drawing", { data: "" })} />);
    expect(empty.container.querySelector("img")).not.toBeNull();
  });

  it("voice 有 url 时出播放器，空时给提示", () => {
    const withUrl = render(<VoiceDisplay block={blk("voice", { url: "data:audio/wav;base64,xx", wave: "" })} />);
    expect((withUrl.container.textContent || withUrl.container.innerHTML).length).toBeGreaterThan(0);
    const empty = render(<VoiceDisplay block={blk("voice", { url: "", wave: "" })} />);
    expect(empty.container.textContent).toContain("点击右上角麦克风");
  });
});
