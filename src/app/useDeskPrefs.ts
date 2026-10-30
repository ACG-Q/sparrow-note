import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 桌面栏位的持久化偏好：导航栏 / 目录栏 / 锁定。
 *
 * 从 App.tsx 里搬出来的（原样搬，不改行为）：
 * - 初值读 localStorage
 * - 变更写回
 * - 窗口变窄自动收起（锁定后不自动收）
 */
export type DeskPrefs = {
  navOn: boolean;
  listOn: boolean;
  locked: boolean;
  setNavOn: (v: boolean | ((prev: boolean) => boolean)) => void;
  setListOn: (v: boolean | ((prev: boolean) => boolean)) => void;
  setLocked: (v: boolean | ((prev: boolean) => boolean)) => void;
};

function prefFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "0";
  } catch {
    return true;
  }
}

export function useDeskPrefs(): DeskPrefs {
  const [navOn, setNavOn] = useState(() => prefFlag("sparrow-desk-nav"));
  const [listOn, setListOn] = useState(() => prefFlag("sparrow-desk-list"));
  const [locked, setLocked] = useState(() => {
    try {
      return localStorage.getItem("sparrow-desk-lock") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("sparrow-desk-nav", navOn ? "1" : "0");
      localStorage.setItem("sparrow-desk-list", listOn ? "1" : "0");
      localStorage.setItem("sparrow-desk-lock", locked ? "1" : "0");
    } catch {
      // 存不上就算了，不影响使用
    }
  }, [navOn, listOn, locked]);

  // 窄窗时自动收起栏位；锁定后不自动收
  useEffect(() => {
    if (locked) return;
    const mqList = window.matchMedia("(max-width: 1179px)");
    const mqNav = window.matchMedia("(max-width: 859px)");
    const apply = () => {
      if (mqList.matches) setListOn(false);
      if (mqNav.matches) setNavOn(false);
    };
    apply();
    mqList.addEventListener("change", apply);
    mqNav.addEventListener("change", apply);
    return () => {
      mqList.removeEventListener("change", apply);
      mqNav.removeEventListener("change", apply);
    };
  }, [locked]);

  return { navOn, listOn, locked, setNavOn, setListOn, setLocked };
}

/**
 * 窄屏判定（768px）。窄屏不是独立路由，而是同一份代码的分支，
 * 所以这个值在 App 里被反复用来决定渲染哪一套外壳。
 */
export function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(
    () => window.matchMedia("(max-width: 768px)").matches,
  );
  const ref = useRef(isNarrow);
  ref.current = isNarrow;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => setIsNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isNarrow;
}

/**
 * 编辑器里的「已保存 / 未保存」轻提示：只亮 1.6 秒就回落。
 */
export function useSaveIndicator() {
  const [saveState, setSaveState] = useState<"idle" | "ok" | "err">("idle");
  const timer = useRef<number | null>(null);

  const markSave = useCallback((ok: boolean) => {
    setSaveState(ok ? "ok" : "err");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaveState("idle"), 1600);
  }, []);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return { saveState, markSave };
}
