/**
 * 平台判定。
 * 用 UA 而不是再加一个 tauri-plugin-os：判断粒度只到"桌面 / 移动 / 浏览器"，
 * UA 已经够用，还能顺带认出 Windows/macOS/Linux 给文案用。
 */

export type Platform = "windows" | "macos" | "linux" | "android" | "ios" | "web";

export function inTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

const VALID: Platform[] = ["windows", "macos", "linux", "android", "ios", "web"];

/** 调试用：?platform=windows 可以在这里强制定位平台，方便看不同平台下的页面 */
function override(): Platform | null {
  if (typeof location === "undefined") return null;
  try {
    const v = new URLSearchParams(location.search).get("platform");
    return v && (VALID as string[]).includes(v) ? (v as Platform) : null;
  } catch {
    return null;
  }
}

export function currentPlatform(ua = typeof navigator === "undefined" ? "" : navigator.userAgent): Platform {
  const forced = override();
  if (forced) return forced;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if (inTauri()) {
    if (isAndroid) return "android";
    if (isIOS) return "ios";
    if (/Windows NT/i.test(ua)) return "windows";
    if (/Mac OS X/i.test(ua)) return "macos";
    return "linux";
  }
  // 浏览器里跑开发版：移动浏览器按移动算，其余算 web
  if (isAndroid) return "android";
  if (isIOS) return "ios";
  return "web";
}

export function isMobile(p: Platform): boolean {
  return p === "android" || p === "ios";
}

export function isDesktop(p: Platform): boolean {
  return p === "windows" || p === "macos" || p === "linux";
}

export function platformLabel(p: Platform): string {
  switch (p) {
    case "windows":
      return "Windows 桌面端";
    case "macos":
      return "macOS 桌面端";
    case "linux":
      return "Linux 桌面端";
    case "android":
      return "Android";
    case "ios":
      return "iOS";
    default:
      return "浏览器";
  }
}

/** 各平台去系统设置里改权限的路径，用在「被拒绝」时的提示 */
export function settingsHint(p: Platform): string | null {
  switch (p) {
    case "windows":
      return "Windows 设置 → 隐私和安全性 → 麦克风 / 相机 / 位置";
    case "macos":
      return "系统设置 → 隐私与安全性 → 麦克风 / 相机 / 定位服务";
    case "linux":
      return "系统设置 → 隐私 → 权限";
    case "android":
      return "系统设置 → 应用 → 麻雀记 → 权限";
    case "ios":
      return "设置 → 麻雀记";
    default:
      return "浏览器地址栏左侧的站点设置里可以改";
  }
}
