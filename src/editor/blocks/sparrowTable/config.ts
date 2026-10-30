import { defaultProps } from "@blocknote/core";
import type { ReactCustomBlockRenderProps } from "@blocknote/react";

/**
 * 自研表格块（P0：只读渲染）。
 *
 * 为什么不用内置 table：内置表格单元格的 content 是 `tableParagraph(inline*)`，
 * 结构上放不了图片/代码块/清单（schema 层面就不允许，见 docs/dev/07）。
 * 这里把整张表序列化进 props.data，单元格里放**块数组**，渲染时按块类型走。
 */
export const sparrowTableConfig = {
  type: "sparrowTable",
  propSchema: {
    ...defaultProps,
    /** JSON：{ headerRows, headerCols, rows: [[{ blocks, colspan, rowspan }]] } */
    data: { default: "" },
    /** 单元格最小宽度（ch），空串表示由内容决定 */
    cellMinWidth: { default: 0 },
  },
  content: "none",
} as const;

export type SparrowTableBlockProps = ReactCustomBlockRenderProps<typeof sparrowTableConfig>;
