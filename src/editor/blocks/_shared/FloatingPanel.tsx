import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import s from "./FloatingPanel.module.css";

/** 悬浮编辑层：锚定到块，portal 到 body，不占文档流，也不遮罩整页。 */
export function FloatingPanel({
  anchor,
  onClose,
  width = 280,
  children,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const place = () => {
      const a = anchor.getBoundingClientRect();
      const w = panel.offsetWidth || width;
      const h = panel.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const left = Math.min(Math.max(8, a.left), Math.max(8, vw - w - 8));
      let top = a.bottom + 8;
      if (top + h > vh - 8) {
        const above = a.top - h - 8;
        top = above >= 8 ? above : Math.max(8, vh - h - 8);
      }
      setPos((prev) =>
        prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - left) < 0.5
          ? prev
          : { top, left },
      );
    };

    place();
    const ro = new ResizeObserver(place);
    ro.observe(panel);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, width]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchor?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      className={s.panel}
      style={{
        top: pos ? pos.top : -9999,
        left: pos ? pos.left : -9999,
        width,
        visibility: pos ? "visible" : "hidden",
      }}
      contentEditable={false}
    >
      {children}
    </div>,
    document.body,
  );
}
