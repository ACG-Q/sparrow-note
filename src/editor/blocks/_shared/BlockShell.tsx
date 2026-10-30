import { type ReactNode } from "react";
import { BlockIcon } from "../../icons";
import s from "./blockCommon.module.css";

export function useStartEmpty(...values: string[]): boolean {
  return values.every((v) => !v);
}

export function stopMouseDown(e: React.MouseEvent): void {
  e.stopPropagation();
}

export function BlockCard({
  chip,
  chipClassName,
  actions,
  active,
  onClick,
  className,
  alwaysActions,
  children,
}: {
  chip?: ReactNode;
  chipClassName?: string;
  actions?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  /** 空块（还没录音/还没画）时操作钮常显，否则新块根本找不到入口 */
  alwaysActions?: boolean;
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
        <span
          className={alwaysActions ? `${s.actions} ${s.actionsOn}` : s.actions}
          contentEditable={false}
        >
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

export function EditBar({ onDone, typeLabel, iconType }: {
  onDone: () => void;
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
