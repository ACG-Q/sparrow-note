import { useEffect, useReducer } from "react";
import { useEditorChange } from "@blocknote/react";
import { useBlockEdit, useIsMobile } from "./BlockEditContext";
import { EDIT_FORMS, type PanelFormProps } from "./editForms";
import { EditBar } from "./BlockShell";
import type { AppBlock } from "../../schema";
import s from "./EditHost.module.css";

export function EditHost() {
  const { editor, pending, close } = useBlockEdit();
  const mobile = useIsMobile();
  const [, tick] = useReducer((x: number) => x + 1, 0);

  // 侧边栏表单渲染在编辑器 DOM 之外，受控输入依赖此订阅读到最新的 block.props
  useEditorChange(() => tick(), editor);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  useEffect(() => {
    if (pending && !editor.getBlock(pending.blockId)) close();
  }, [pending, close, editor]);

  if (!pending) return null;
  const block = editor.getBlock(pending.blockId) as AppBlock | undefined;
  const Form = EDIT_FORMS[pending.type];
  if (!block || !Form) return null;

  const formProps: PanelFormProps = {
    block,
    editor,
    onDone: close,
    onCancel: close,
  };

  if (pending.container === "side") {
    const bar = (
      <EditBar onDone={close} onCancel={close} typeLabel={pending.label} iconType={pending.iconType} />
    );
    if (mobile) {
      return (
        <>
          <div className={s.backdrop} onClick={close} contentEditable={false} />
          <div className={s.drawer} contentEditable={false}>
            <div className={s.handle} />
            <Form {...formProps} />
            {bar}
          </div>
        </>
      );
    }
    return (
      <div className={s.side} contentEditable={false}>
        <Form {...formProps} />
        {bar}
      </div>
    );
  }

  return (
    <div className={s.modalBackdrop} onClick={close} contentEditable={false}>
      <div
        className={s.modal}
        onClick={(e) => e.stopPropagation()}
        contentEditable={false}
      >
        <Form {...formProps} />
      </div>
    </div>
  );
}
