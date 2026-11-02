// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteEditor } from "./NoteEditor";

/**
 * NoteEditor 的冒烟测试：它整个依赖 BlockNote（ProseMirror + Mantine 主题），
 * 单测里能做的只有「装得起来、不崩、编辑器根节点在、卸载不报错」。
 * 真正的输入/斜杠菜单/表格交互仍然靠在真实页面里用 CDP 探针驱动（探针脚本不入库）。
 */
describe("NoteEditor 冒烟", () => {
  it("能挂载出可编辑的编辑器根节点", async () => {
    const onChange = vi.fn();
    const { container, unmount } = render(<NoteEditor initialContent={[]} onChange={onChange} />);

    // BlockNote 初始化是异步的（动态加载语言包 / 主题），等它把根节点挂上
    let editor: Element | null = null;
    for (let i = 0; i < 40; i++) {
      editor = container.querySelector(".bn-editor");
      if (editor) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(editor).not.toBeNull();
    unmount();
  });

  it("给了初始内容时不抛错", async () => {
    const blocks = [
      {
        id: "b1",
        type: "paragraph",
        props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
        content: [{ type: "text", text: "开场白", styles: {} }],
        children: [],
      },
    ];
    const { container, unmount } = render(
      <NoteEditor initialContent={blocks as never} onChange={() => {}} />,
    );
    await new Promise((r) => setTimeout(r, 400));
    expect(container.innerHTML.length).toBeGreaterThan(0);
    unmount();
  });
});
