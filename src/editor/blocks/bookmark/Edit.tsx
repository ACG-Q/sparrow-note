import s from "./styles.module.css";
import { LinkIcon } from "../../icons";
import { PanelSection, PanelInput, SwitchRow } from "../_shared/panelKit";
import { type BookmarkBlockT, type BookmarkEditor } from "./config";

export default function BookmarkEdit({
  block,
  editor,
}: {
  block: BookmarkBlockT;
  editor: BookmarkEditor;
}) {
  const set = (key: "title" | "url") => (e: React.ChangeEvent<HTMLInputElement>) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  const valid = /^https?:\/\//i.test(block.props.url);
  return (
    <>
      <PanelSection label="标题">
        <PanelInput placeholder="链接标题" value={block.props.title} onChange={set("title")} />
      </PanelSection>
      <PanelSection label="网址">
        <PanelInput placeholder="https://…" value={block.props.url} onChange={set("url")} />
      </PanelSection>
      <SwitchRow
        title="新标签页打开"
        desc="关闭时将在当前页内跳转"
        checked={block.props.newTab}
        onChange={(v) => editor.updateBlock(block, { props: { newTab: v } })}
      />
      <PanelSection label="预览">
        <div className={s.preview}>
          <span className={s.title}>{block.props.title || "未命名链接"}</span>
          {block.props.url && <span className={s.url}>{block.props.url}</span>}
          {valid && (
            <span className={s.openRow}>
              <LinkIcon />
              在浏览器中打开
            </span>
          )}
        </div>
      </PanelSection>
    </>
  );
}
