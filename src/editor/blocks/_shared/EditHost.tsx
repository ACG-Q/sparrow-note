import { useEffect, useReducer } from "react";
import { useEditorChange } from "@blocknote/react";
import { useBlockEdit, useIsMobile } from "./BlockEditContext";
import { EDIT_FORMS, type PanelFormProps } from "./editForms";
import { BlockIcon } from "../../icons";
import type { AppBlock } from "../../schema";
import s from "./EditHost.module.css";

function siteHost(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function PanelHead({
  type,
  label,
  block,
  onClose,
}: {
  type: string;
  label: string;
  block: AppBlock;
  onClose: () => void;
}) {
  const props = block.props as Record<string, string>;
  let icon: React.ReactNode = <BlockIcon type={type} />;
  let title = label;
  let sub = "";
  if (type === "contact") {
    icon = <span className={s.headAvatar}>{(props.name || "?").slice(0, 1)}</span>;
    title = props.name || "新建联系人";
    sub = "保存到笔记的联系人块";
  } else if (type === "account") {
    icon = <span className={s.headLogo}>{(props.site || "?").slice(0, 1).toUpperCase()}</span>;
    title = props.site || "账号";
    sub = [props.user, siteHost(props.url)].filter(Boolean).join(" · ") || "站点凭据管理";
  } else if (type === "anniversary") {
    sub = "正计时 · 倒计时 · 纪念日";
  } else if (type === "location") {
    sub = "定位获取 · 手动兜底";
  } else if (type === "bookmark") {
    sub = "保存网页链接";
  } else if (type === "bankcard") {
    sub = "卡面实时预览";
  }
  return (
    <div className={s.head} contentEditable={false}>
      <span className={s.headIcon}>{icon}</span>
      <div className={s.headTitles}>
        <div className={s.headTitle}>{title}</div>
        {sub && <div className={s.headSub}>{sub}</div>}
      </div>
      <button
        type="button"
        className={s.headClose}
        aria-label="关闭"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

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
  const head = <PanelHead type={pending.type} label={pending.label} block={block} onClose={close} />;

  if (pending.container === "side") {
    const foot = (
      <div className={s.foot} contentEditable={false}>
        <span className={s.footHint}>Esc 关闭</span>
        <button
          type="button"
          className={s.btnDone}
          onMouseDown={(e) => e.preventDefault()}
          onClick={close}
        >
          完成
        </button>
      </div>
    );
    if (mobile) {
      return (
        <>
          <div className={s.backdrop} onClick={close} contentEditable={false} />
          <div className={s.drawer} contentEditable={false}>
            <div className={s.handle} />
            {head}
            <div className={s.body}>
              <Form {...formProps} />
            </div>
            {foot}
          </div>
        </>
      );
    }
    return (
      <>
        <div className={s.backdrop} onClick={close} contentEditable={false} />
        <div className={s.side} contentEditable={false}>
          {head}
          <div className={s.body}>
            <Form {...formProps} />
          </div>
          {foot}
        </div>
      </>
    );
  }

  return (
    <div className={s.modalBackdrop} onClick={close} contentEditable={false}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()} contentEditable={false}>
        {head}
        <div className={s.modalBody}>
          <Form {...formProps} />
        </div>
      </div>
    </div>
  );
}
