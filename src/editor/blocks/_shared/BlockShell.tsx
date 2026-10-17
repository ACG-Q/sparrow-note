import { type ReactNode } from "react";
import { BlockIcon } from "../../icons";
import s from "./blockCommon.module.css";

export function useStartEmpty(...values: string[]): boolean {
  return values.every((v) => !v);
}

export function stopMouseDown(e: React.MouseEvent): void {
  e.stopPropagation();
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

export function BlockCard({
  chip,
  chipClassName,
  actions,
  active,
  onClick,
  className,
  children,
}: {
  chip?: ReactNode;
  chipClassName?: string;
  actions?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const cls = [s.card, active ? s.cardActive : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <div
      className={cls}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick?.();
      }}
    >
      {chip && (
        <span
          className={chipClassName ? `${s.chip} ${chipClassName}` : s.chip}
          contentEditable={false}
        >
          {chip}
        </span>
      )}
      <div className={s.cardBody}>{children}</div>
      {actions && (
        <span className={s.actions} contentEditable={false}>
          {actions}
        </span>
      )}
    </div>
  );
}

export function ActionBtn({
  icon,
  label,
  onClick,
  light,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  light?: boolean;
  danger?: boolean;
}) {
  const cls = [s.action, light ? s.actionLight : "", danger ? s.actionDanger : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {icon}
    </button>
  );
}

export function EditBar({
  onDone,
  onCancel,
  typeLabel,
  iconType,
}: {
  onDone: () => void;
  onCancel?: () => void;
  typeLabel?: string;
  iconType?: string;
}) {
  return (
    <div className={s.editbar} contentEditable={false}>
      {typeLabel && (
        <span className={s.typeLabel}>
          <BlockIcon type={iconType ?? ""} />
          {typeLabel}
        </span>
      )}
      {onCancel && (
        <button
          type="button"
          className={s.cancel}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onCancel}
        >
          取消
        </button>
      )}
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
