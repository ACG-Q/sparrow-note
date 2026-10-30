import { useEffect, useRef } from "react";

/**
 * 「刚插入的空块自动打开编辑面板」。
 *
 * 以前每个自定义块都手写这段：
 *
 * ```ts
 * useEffect(() => {
 *   if (!startEmpty) return;
 *   openEdit();
 *   return close;
 * }, []);   // ← 依赖只有 []，openEdit/close 换引用时规则会报未声明依赖
 * ```
 *
 * 语义是「只在挂载时跑一次」，但 `openEdit` / `close` 来自 context、每帧都是新函数，
 * 于是只能靠抑制注释。现在把最新回调塞进 ref，依赖就只剩「该不该开」这一个布尔，
 * 规则也能正常检查。
 */
export function useAutoEditOnEmpty(
  enabled: boolean,
  openEdit: () => void,
  close: () => void,
): void {
  const openRef = useRef(openEdit);
  openRef.current = openEdit;
  const closeRef = useRef(close);
  closeRef.current = close;
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current || !enabled) return;
    opened.current = true;
    openRef.current();
    return () => {
      // 重置标记：StrictMode 会「挂载 → 清理 → 再挂载」跑两遍，
      // 如果这里不重置，第二次就不会再打开面板（实测会退化成「点了没反应」）。
      opened.current = false;
      closeRef.current();
    };
  }, [enabled]);
}
