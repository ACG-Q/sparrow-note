/**
 * 防抖落盘的小工具。
 *
 * 为什么单独抽出来：编辑器「停手 400ms 再保存」这段逻辑以前写在组件里，
 * 卸载时只 `clearTimeout` 不补写——最后一句会静默丢失（实测复现过）。
 * 抽成纯对象后：① 行为可单测 ② `flush()` 明确表达「卸载前把没写的补上」。
 */
export type DebouncedSink<T> = {
  /** 收到新值：延后 delayMs 落盘，期间再来新值就重新计时 */
  push: (value: T) => void;
  /** 立刻落盘（如果有没写的），并取消计时 */
  flush: () => void;
  /** 取消计时且**丢弃**未写内容（真的不要了再用） */
  cancel: () => void;
  /** 当前有没有还没落盘的值 */
  hasPending: () => boolean;
};

export function createDebouncedSink<T>(
  delayMs: number,
  write: (value: T) => void,
): DebouncedSink<T> {
  let timer: number | null = null;
  let pending: { value: T } | null = null;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    push(value: T) {
      pending = { value };
      clear();
      timer = setTimeout(() => {
        timer = null;
        const p = pending;
        pending = null;
        if (p) write(p.value);
      }, delayMs) as unknown as number;
    },
    flush() {
      clear();
      const p = pending;
      pending = null;
      if (p) write(p.value);
    },
    cancel() {
      clear();
      pending = null;
    },
    hasPending() {
      return pending !== null;
    },
  };
}
