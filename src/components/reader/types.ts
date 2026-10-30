/** 阅读态渲染用的最小块类型（只取读到的那几个字段） */
export type AnyBlock = {
  id?: string;
  type: string;
  props: Record<string, unknown>;
  content?: unknown;
  children?: AnyBlock[];
};
