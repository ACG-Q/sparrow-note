import { createReactBlockSpec } from "@blocknote/react";
import { SparrowTableFromProps } from "../../../components/SparrowTable";
import { sparrowTableConfig, type SparrowTableBlockProps } from "./config";

/**
 * 自研表格块的编辑器内渲染。
 * P0 只读：编辑态下也按阅读样式显示，不接单元格编辑（P1 再做）。
 */
function SparrowTableRender({ block }: SparrowTableBlockProps) {
  const minWidth = Number(block.props.cellMinWidth) || undefined;
  return (
    <div contentEditable={false}>
      <SparrowTableFromProps data={block.props.data} minWidth={minWidth} />
    </div>
  );
}

export const SparrowTableBlock = createReactBlockSpec(sparrowTableConfig, {
  render: SparrowTableRender,
});
