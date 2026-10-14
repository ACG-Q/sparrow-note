import { createReactBlockSpec, ReactCustomBlockRenderProps } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { LinkIcon } from "../icons";

const bookmarkConfig = {
  type: "bookmark",
  propSchema: {
    ...defaultProps,
    title: { default: "" },
    url: { default: "" },
  },
  content: "none",
} as const;

type BookmarkProps = ReactCustomBlockRenderProps<typeof bookmarkConfig>;

function BookmarkRender({ block, editor }: BookmarkProps) {
  const set = (key: "title" | "url") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      editor.updateBlock(block, { props: { [key]: e.target.value } });
    };
  const valid = /^https?:\/\//i.test(block.props.url);
  return (
    <div className="bn-bookmark">
      <span className="bn-bookmark-icon" contentEditable={false}>
        <LinkIcon />
      </span>
      <div className="bn-bookmark-body">
        <input
          className="bn-input bn-bookmark-title"
          placeholder="链接标题"
          value={block.props.title}
          onChange={set("title")}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <input
          className="bn-input bn-bookmark-url"
          placeholder="https://…"
          value={block.props.url}
          onChange={set("url")}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
      {valid && (
        <a
          className="bn-bookmark-open"
          href={block.props.url}
          target="_blank"
          rel="noreferrer noopener"
          contentEditable={false}
          onMouseDown={(e) => e.stopPropagation()}
        >
          打开
        </a>
      )}
    </div>
  );
}

export const BookmarkBlock = createReactBlockSpec(bookmarkConfig, {
  render: (props) => <BookmarkRender {...props} />,
});
