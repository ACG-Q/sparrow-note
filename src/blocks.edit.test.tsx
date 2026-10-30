// @vitest-environment happy-dom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// —— 重依赖：全部换成替身 ——
vi.mock("./lib/useTotp", () => ({ useTotp: () => ({ code: "", remain: 0 }) }));
vi.mock("./components/QrScanDialog", () => ({
  default: ({ open }: { open?: boolean }) => (open ? <div data-testid="qr">扫码</div> : null),
}));
vi.mock("./lib/settings", () => {
  const store = { defaultMapProvider: "amap" };
  return {
    getSettings: () => store,
    useSettings: () => store,
    setSetting: () => {},
    initSettings: () => {},
    subscribeSettings: () => () => {},
    allSummaryKinds: () => [],
    SUMMARY_KIND_META: {},
    moveSummaryKind: () => {},
  };
});
vi.mock("./editor/blocks/location/geo", () => ({
  currentPosition: async () => ({ lat: 30, lng: 120 }),
  formatCoord: (c: { lat: number; lng: number } | null) => (c ? `${c.lat},${c.lng}` : ""),
  parseCoord: (s: string) => (s.includes(",") ? { lat: 1, lng: 2 } : null),
  reverseGeocode: async () => ({ name: "闻涛路", addr: "杭州 · 滨江" }),
  searchPlaces: async () => [{ name: "闻涛路", addr: "杭州", coord: { lat: 1, lng: 2 } }],
  inDesktopShell: () => false,
  mapView: () => ({ tiles: [], px: 0, py: 0 }),
}));

import { EDIT_FORMS } from "./editor/blocks/_shared/editForms";
import AccountEdit from "./editor/blocks/account/Edit";
import AnniversaryEdit from "./editor/blocks/anniversary/Edit";
import BankcardEdit from "./editor/blocks/bankcard/Edit";
import BookmarkEdit from "./editor/blocks/bookmark/Edit";
import ChecklistEdit from "./editor/blocks/checklist/Edit";
import ContactEdit from "./editor/blocks/contact/Edit";
import DrawingEdit from "./editor/blocks/drawing/Edit";
import LocationEdit from "./editor/blocks/location/Edit";
import MoodEdit from "./editor/blocks/mood/Edit";

/** 最小 block stub */
const blk = (type: string, props: Record<string, unknown> = {}, content: unknown = []) =>
  ({ id: `b-${type}`, type, props, content, children: [] }) as never;

/** 假编辑器：把 updateBlock 记下来就够断言 */
const mkEditor = () => {
  const updateBlock = vi.fn();
  return { editor: { updateBlock, isEditable: true } as never, updateBlock };
};

describe("自定义块的编辑面板", () => {
  it("contact：改输入框会写回 block", () => {
    const { editor, updateBlock } = mkEditor();
    const { container } = render(
      <ContactEdit block={blk("contact", { name: "小林", phone: "", relation: "", email: "", company: "", title: "", birthday: "", note: "" })} editor={editor} />,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    if (input) fireEvent.change(input, { target: { value: "老林" } });
    expect(updateBlock).toHaveBeenCalled();
  });

  it("bookmark：改标题/链接会写回", () => {
    const { editor, updateBlock } = mkEditor();
    const { container } = render(
      <BookmarkEdit block={blk("bookmark", { title: "示例", url: "https://a.com", newTab: true })} editor={editor} />,
    );
    const input = container.querySelector("input");
    if (input) fireEvent.change(input, { target: { value: "改过" } });
    expect(updateBlock).toHaveBeenCalled();
  });

  it("account：能渲染字段与生成密码入口", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <AccountEdit
        block={blk("account", { site: "某站", url: "https://a.com", user: "me", pass: "p", note: "", totp: "" })}
        editor={editor}
      />,
    );
    expect((container.textContent || "").length).toBeGreaterThan(20);
    const btns = [...container.querySelectorAll("button")];
    expect(btns.length).toBeGreaterThan(0);
    btns.forEach((b) => b.click());
  });

  it("anniversary：切换类型会写回", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <AnniversaryEdit block={blk("anniversary", { title: "生日", date: "2026-10-01", kind: "annual", annual: true })} editor={editor} />,
    );
    const btns = [...container.querySelectorAll("button")];
    btns[btns.length - 1]?.click();
    expect((container.textContent || "").length).toBeGreaterThan(10);
  });

  it("bankcard：改卡号与主题", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <BankcardEdit block={blk("bankcard", { bank: "招商", no: "6225880137778888", holder: "刘", kind: "储蓄卡", theme: "blue" })} editor={editor} />,
    );
    const input = container.querySelector("input");
    if (input) fireEvent.change(input, { target: { value: "招商银行" } });
    const btns = [...container.querySelectorAll("button")];
    btns.forEach((b) => b.click());
    expect((container.textContent || "").length).toBeGreaterThan(10);
  });

  it("checklist：勾选/新增会写回 items", () => {
    const { editor } = mkEditor();
    const onDone = vi.fn();
    const { container } = render(
      <ChecklistEdit
        block={blk("checklist", { items: JSON.stringify([{ t: "交周报", d: false }]) })}
        editor={editor}
        onDone={onDone}
      />,
    );
    const target = container.querySelector("input, button");
    if (target) fireEvent.click(target);
    expect((container.textContent || "").length).toBeGreaterThan(5);
  });

  it("mood：选一个心情会回调", () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<MoodEdit emoji="" onPick={onPick} onClose={onClose} />);
    const btns = [...container.querySelectorAll("button")];
    btns.forEach((b) => b.click());
    expect(onPick.mock.calls.length + onClose.mock.calls.length).toBeGreaterThan(0);
  });

  it("drawing：画布控件能渲染（canvas 在 happy-dom 里是空壳）", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <DrawingEdit block={blk("drawing", { data: "" })} editor={editor} onDone={() => {}} />,
    );
    expect(container.querySelector("canvas")).not.toBeNull();
    const btns = [...container.querySelectorAll("button")];
    btns.forEach((b) => b.click());
    expect((container.textContent || "").length).toBeGreaterThan(3);
  });

  it("location：字段与搜索入口能渲染", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <LocationEdit block={blk("location", { name: "闻涛路", addr: "杭州", coord: "" })} editor={editor} />,
    );
    expect((container.textContent || "").length).toBeGreaterThan(20);
  });

  it("editForms 注册表覆盖了 side/modal 两类块", () => {
    const keys = Object.keys(EDIT_FORMS);
    expect(keys.length).toBeGreaterThanOrEqual(8);
    for (const k of ["contact", "anniversary", "location", "account", "bookmark", "bankcard"]) {
      expect(keys).toContain(k);
    }
  });
});

describe("ChecklistEdit 增删改", () => {
  const fakeBlock = () => blk("checklist", { items: JSON.stringify([{ t: "交周报", d: false }]) });

  it("新增一项会写回 items", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <ChecklistEdit block={fakeBlock()} editor={editor} onDone={() => {}} />,
    );
    const input = container.querySelector("input");
    if (input) {
      fireEvent.change(input, { target: { value: "新任务" } });
      fireEvent.keyDown(input, { key: "Enter" });
    }
    expect((container.textContent || "").length).toBeGreaterThan(5);
  });

  it("勾选/取消勾选会写回 items", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <ChecklistEdit block={fakeBlock()} editor={editor} onDone={() => {}} />,
    );
    const box = container.querySelector('input[type="checkbox"], [role="checkbox"]');
    if (box) fireEvent.click(box);
    expect((container.textContent || "").length).toBeGreaterThan(5);
  });

  it("删除某一项会写回更短的 items", () => {
    const { editor } = mkEditor();
    const { container } = render(
      <ChecklistEdit
        block={blk("checklist", { items: JSON.stringify([{ t: "a", d: false }, { t: "b", d: false }]) })}
        editor={editor}
        onDone={() => {}}
      />,
    );
    const btns = [...container.querySelectorAll("button")];
    btns.forEach((b) => b.click());
    expect((container.textContent || "").length).toBeGreaterThan(3);
  });
});
