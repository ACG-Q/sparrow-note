import { useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { bookmarkConfig, type BookmarkProps } from "./config";
import BookmarkDisplay from "./Display";
import BookmarkEdit from "./Edit";

function BookmarkRender({ block, editor }: BookmarkProps) {
  const [editing, setEditing] = useState(() => !(block.props.title || block.props.url));
  if (editing) {
    return <BookmarkEdit block={block} editor={editor} onDone={() => setEditing(false)} />;
  }
  return <BookmarkDisplay block={block} onEdit={() => setEditing(true)} />;
}

export const BookmarkBlock = createReactBlockSpec(bookmarkConfig, {
  render: (props) => <BookmarkRender {...props} />,
});
