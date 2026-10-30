import { isTauri } from "../db/notes";

/**
 * 发一条系统通知。
 * - 桌面 / 移动端：走 @tauri-apps/plugin-notification（全平台同一套 API）
 * - 浏览器：用 Web Notification
 * 返回是否真的发出去了（权限被拒时返回 false，调用方可以退回页面内提示）。
 */
export async function notify(title: string, body: string): Promise<boolean> {
  if (isTauri()) {
    try {
      const api = await import("@tauri-apps/plugin-notification");
      let granted = await api.isPermissionGranted();
      if (!granted) granted = (await api.requestPermission()) === "granted";
      if (!granted) return false;
      await api.sendNotification({ title, body });
      return true;
    } catch {
      return false;
    }
  }

  if (typeof Notification === "undefined") return false;
  try {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission !== "granted") return false;
    new Notification(title, { body });
    return true;
  } catch {
    return false;
  }
}

export async function notifyPermission(): Promise<"granted" | "denied" | "unknown"> {
  if (isTauri()) {
    try {
      const api = await import("@tauri-apps/plugin-notification");
      const granted = await api.isPermissionGranted();
      if (granted) return "granted";
      return (await api.requestPermission()) === "granted" ? "granted" : "denied";
    } catch {
      return "unknown";
    }
  }
  if (typeof Notification === "undefined") return "unknown";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "unknown";
}
