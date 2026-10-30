import { createReactBlockSpec } from "@blocknote/react";
import { PencilIcon, TrashIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { useAutoEditOnEmpty } from "../_shared/useAutoEditOnEmpty";
import { ActionBtn, BlockCard, useStartEmpty } from "../_shared/BlockShell";
import { bookmarkConfig, type BookmarkProps } from "./config";
import BookmarkDisplay from "./Display";

function BookmarkRender({ block, editor }: BookmarkProps) {
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

  useAutoEditOnEmpty(startEmpty, openEdit, close);

  return (
    <BlockCard
      active={pending?.blockId === block.id}
      onClick={openEdit}
      actions={
          <>
            <ActionBtn icon={<PencilIcon />} label="编辑书签" onClick={openEdit} />
            <ActionBtn
              icon={<TrashIcon />}
              label="删除书签"
              danger
              onClick={() => editor.removeBlocks([block])}
            />
          </>
        }
    >
      <BookmarkDisplay block={block} />
    </BlockCard>
  );
}

export const BookmarkBlock = createReactBlockSpec(bookmarkConfig, {
  render: (props) => <BookmarkRender {...props} />,
});
