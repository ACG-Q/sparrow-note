import { useEffect } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { BlockIcon, PencilIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { ActionBtn, BlockCard, useStartEmpty } from "../_shared/BlockShell";
import { bookmarkConfig, type BookmarkProps } from "./config";
import BookmarkDisplay from "./Display";

function BookmarkRender({ block }: BookmarkProps) {
  const { pending, open, close } = useBlockEdit();
  const startEmpty = useStartEmpty(block.props.title, block.props.url);
  const openEdit = () =>
    open({
      blockId: block.id,
      container: "side",
      type: "bookmark",
      label: "书签",
      iconType: "bookmark",
    });

  useEffect(() => {
    if (!startEmpty) return;
    openEdit();
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BlockCard
      chip={<BlockIcon type="bookmark" />}
      active={pending?.blockId === block.id}
      onClick={openEdit}
      actions={<ActionBtn icon={<PencilIcon />} label="编辑书签" onClick={openEdit} />}
    >
      <BookmarkDisplay block={block} />
    </BlockCard>
  );
}

export const BookmarkBlock = createReactBlockSpec(bookmarkConfig, {
  render: (props) => <BookmarkRender {...props} />,
});
