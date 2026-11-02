import { isTauriMobile } from "./platform";

/**
 * 危险操作（清空、覆盖导入）的二次确认。
 *
 * 安卓 WebView 里 `window.confirm` 由 wry 的 WebChromeClient 接管，弹的是系统 AlertDialog，
 * 消息是中文、按钮却是英文 `OK / CANCEL`，跟界面语言不一致。
 * 移动端改用 plugin-dialog 的 `confirm()`：标题、按钮文案都能写中文，观感也统一。
 * 浏览器与桌面 WebView 仍用 `window.confirm`，行为和原来一样。
 */
export type ConfirmOptions = {
  title?: string;
  okLabel?: string;
  cancelLabel?: string;
};

export async function confirmAction(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  if (!isTauriMobile()) return window.confirm(message);

  const dialog = await import("@tauri-apps/plugin-dialog");
  return dialog.confirm(message, {
    title: opts.title ?? "确认",
    kind: "warning",
    okLabel: opts.okLabel ?? "确定",
    cancelLabel: opts.cancelLabel ?? "取消",
  });
}
