import type { ReactNode } from "react";
import { AccountCard } from "../AccountCard";
import { AudioPlayer } from "../../editor/blocks/_shared/AudioPlayer";
import { saveImageAs } from "../../lib/download";
import { groupNo, maskNo, THEME_CLASS, type BankTheme } from "../../editor/blocks/bankcard/config";
import bankS from "../../editor/blocks/bankcard/styles.module.css";
import s from "../NoteReader.module.css";
import type { AnyBlock } from "./types";

/**
 * 阅读态的「实体/附件」块渲染器。
 *
 * 这些块只依赖块自己的 props + 少量页面状态（是否露出卡号、要不要弹预览），
 * 所以能从 NoteReader 那个 300 多行的 switch 里抽出来单独测。
 */

/** 只读页面上这几个渲染器需要的东西 */
export type EntityRenderCtx = {
  /** 是否显示完整卡号（个人化设置） */
  showCard: boolean;
  /** 打开大图预览 */
  onPreviewImage: (url: string, caption: string) => void;
  /** 打开附件预览 */
  onPreviewFile: (target: { name: string; url: string }) => void;
  /** 在同一篇笔记里点过「查看卡号」 */
  onToggleCard: () => void;
  /** 笔记日期，用作下载文件名 */
  noteDate: string;
};

const str = (props: Record<string, unknown>, key: string): string => {
  const v = props[key];
  return typeof v === "string" ? v : "";
};

/** 从文件名取后缀（大写） */
function fileExt(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toUpperCase() : "文件";
}

const BANK_THEMES: BankTheme[] = ["blue", "purple", "teal", "rose"];
const themeOf = (props: Record<string, unknown>): BankTheme => {
  const v = str(props, "theme");
  return BANK_THEMES.includes(v as BankTheme) ? (v as BankTheme) : "blue";
};

/** checklist：勾选进度 + 明细 */
function Checklist({ block, key }: { block: AnyBlock; key: string }): ReactNode {
  let items: { t: string; d: boolean }[] = [];
  try {
    const raw = JSON.parse(str(block.props, "items") || "[]");
    if (Array.isArray(raw)) {
      items = raw.filter(
        (x): x is { t: string; d: boolean } =>
          !!x && typeof x === "object" && typeof (x as { t?: unknown }).t === "string" && typeof (x as { d?: unknown }).d === "boolean",
      );
    }
  } catch {
    items = [];
  }
  if (items.length === 0) return null;
  const doneCount = items.filter((it) => it.d).length;
  const pct = Math.round((doneCount / items.length) * 100);
  return (
    <div key={key} className={s.todoWrap}>
      <div className={s.todoHead}>
        <span className={s.todoCount}>
          {doneCount}/{items.length}
        </span>
        <span className={s.todoBar} aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </span>
      </div>
      <ul className={s.todo}>
        {items.map((it, i) => (
          <li key={i} className={it.d ? s.done : undefined}>
            <span className={s.box} aria-hidden="true">
              {it.d ? "✓" : ""}
            </span>
            {it.t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** bookmark：外链卡片 */
function Bookmark({ block, key }: { block: AnyBlock; key: string }): ReactNode {
  const url = str(block.props, "url");
  if (!url) return null;
  const title = str(block.props, "title") || url;
  return (
    <a key={key} className={s.bookmark} href={url} target="_blank" rel="noreferrer">
      <span className={s.bookmarkText}>
        <span className={s.bookmarkTitle}>{title}</span>
        <span className={s.bookmarkUrl}>{url}</span>
      </span>
      <span className={s.bookmarkOpen}>打开 →</span>
    </a>
  );
}

/** account：密码卡（复用编辑态的 AccountCard） */
function Account({ block, key }: { block: AnyBlock; key: string }): ReactNode {
  const site = str(block.props, "site");
  const user = str(block.props, "user");
  const pass = str(block.props, "pass");
  if (!site && !user && !pass) return null;
  return <AccountCard key={key} props={block.props} />;
}

/** bankcard：阅读态也要出卡面（一行文字和编辑态卡是两样东西） */
function Bankcard({
  block,
  key,
  ctx,
}: {
  block: AnyBlock;
  key: string;
  ctx: EntityRenderCtx;
}): ReactNode {
  const bank = str(block.props, "bank");
  const no = str(block.props, "no");
  const holder = str(block.props, "holder");
  const kind = str(block.props, "kind");
  const digits = no.replace(/\D/g, "");
  if (!bank && !no) return null;
  return (
    <div
      key={key}
      className={[bankS.root, bankS.readonly, THEME_CLASS[themeOf(block.props)]].filter(Boolean).join(" ")}
    >
      <div className={bankS.top}>
        <span className={bankS.bank}>{bank || "未命名银行"}</span>
        {kind ? <span className={bankS.kind}>{kind}</span> : null}
      </div>
      {digits ? <div className={bankS.no}>{ctx.showCard ? groupNo(digits) : maskNo(digits)}</div> : null}
      <div className={bankS.bottom}>
        <span className={bankS.holder}>{holder || "未填持卡人"}</span>
        {digits ? (
          <button type="button" className={bankS.reveal} onClick={ctx.onToggleCard}>
            {ctx.showCard ? "隐藏" : "查看"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** drawing：手绘图，可全屏预览、可存为图片 */
function Drawing({
  block,
  key,
  ctx,
}: {
  block: AnyBlock;
  key: string;
  ctx: EntityRenderCtx;
}): ReactNode {
  const data = str(block.props, "data");
  if (!data) return null;
  return (
    <figure key={key} className={`${s.figure} ${s.drawingFigure}`}>
      <button
        type="button"
        className={s.zoom}
        onClick={() => ctx.onPreviewImage(data, "手绘")}
        aria-label="全屏预览"
      >
        <img className={s.drawingImg} src={data} alt="手绘" />
      </button>
      <figcaption className={s.drawingBar}>
        <span className={s.drawingLabel}>手绘</span>
        <button
          type="button"
          className={s.drawingSave}
          onClick={() => void saveImageAs(data, `手绘-${ctx.noteDate || "note"}.png`)}
        >
          存为图片
        </button>
      </figcaption>
    </figure>
  );
}

/** voice：语音条 */
function Voice({ block, key }: { block: AnyBlock; key: string }): ReactNode {
  const url = str(block.props, "url");
  if (!url) return null;
  return <AudioPlayer key={key} src={url} label="语音" wave={str(block.props, "wave")} />;
}

/** file：附件行 */
function FileBlock({
  block,
  key,
  ctx,
}: {
  block: AnyBlock;
  key: string;
  ctx: EntityRenderCtx;
}): ReactNode {
  const url = str(block.props, "url");
  if (!url) return null;
  const name = str(block.props, "name") || "附件";
  const caption = str(block.props, "caption");
  return (
    <div key={key} className={s.fileRow}>
      <button
        type="button"
        className={s.fileMain}
        onClick={() => ctx.onPreviewFile({ name, url })}
        title="预览"
      >
        <span className={s.fileIcon} aria-hidden="true">
          ▤
        </span>
        <span className={s.fileText}>
          <span className={s.bookmarkTitle}>{name}</span>
          <span className={s.bookmarkUrl}>{caption || fileExt(name)}</span>
        </span>
        <span className={s.fileOpen}>预览</span>
      </button>
      <a className={s.fileDl} href={url} download={name} aria-label="下载">
        下载
      </a>
    </div>
  );
}

/** 块类型 → 渲染器（没登记的类型交给 NoteReader 自己处理） */
export const entityRenderers: Record<
  string,
  (block: AnyBlock, key: string, ctx: EntityRenderCtx) => ReactNode
> = {
  checklist: (block, key) => <Checklist block={block} key={key} />,
  bookmark: (block, key) => <Bookmark block={block} key={key} />,
  account: (block, key) => <Account block={block} key={key} />,
  bankcard: (block, key, ctx) => <Bankcard block={block} key={key} ctx={ctx} />,
  drawing: (block, key, ctx) => <Drawing block={block} key={key} ctx={ctx} />,
  voice: (block, key) => <Voice block={block} key={key} />,
  file: (block, key, ctx) => <FileBlock block={block} key={key} ctx={ctx} />,
};
