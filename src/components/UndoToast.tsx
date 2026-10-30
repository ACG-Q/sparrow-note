import s from "./UndoToast.module.css";

/**
 * 角落里的「已删除 · 撤销」条。
 *
 * 删除这类操作做成「先执行 + 限时撤销」比每次弹确认更轻，
 * 尤其是移动端：点一下就删、想反悔点一下撤销。
 */
export function UndoToast({
  message,
  actionLabel = "撤销",
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  onAction: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className={s.wrap} role="status" aria-live="polite">
      <span className={s.msg}>{message}</span>
      <button type="button" className={s.action} onClick={onAction}>
        {actionLabel}
      </button>
      {onDismiss && (
        <button type="button" className={s.close} aria-label="关闭提示" onClick={onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}
