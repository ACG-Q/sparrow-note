import { type ReactNode } from "react";
import s from "./blockCommon.module.css";

export function useStartEmpty(...values: string[]): boolean {
  return values.every((v) => !v);
}

export function DisplayWrap({
  onEdit,
  className,
  children,
}: {
  onEdit: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={className ? `${s.display} ${className}` : s.display}
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEdit();
      }}
    >
      {children}
      <span className={s.editHint} contentEditable={false}>
        点击编辑
      </span>
    </div>
  );
}

export function EditBar({ onDone, children }: { onDone: () => void; children?: ReactNode }) {
  return (
    <div className={s.editbar} contentEditable={false}>
      {children}
      <button
        type="button"
        className={s.done}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onDone}
      >
        完成
      </button>
    </div>
  );
}

export function stopMouseDown(e: React.MouseEvent): void {
  e.stopPropagation();
}
