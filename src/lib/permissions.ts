import { inTauri, isDesktop, isMobile, settingsHint, type Platform } from "./platform";

export type PermState = "granted" | "prompt" | "denied" | "unsupported" | "unknown";

export type PermissionId = "location" | "microphone" | "camera" | "notification" | "files" | "network";

export type PermissionRow = {
  id: PermissionId;
  name: string;
  why: string;
  usedBy: string;
  state: PermState;
  /** 这个平台能不能在这里发起申请 */
  canRequest: boolean;
  /** 平台差异 / 失败原因 */
  note?: string;
  /** 被拒绝后去哪改 */
  fixHint?: string;
};

const STATE_TEXT: Record<PermState, string> = {
  granted: "已允许",
  prompt: "未申请",
  denied: "已拒绝",
  unsupported: "不适用",
  unknown: "未知",
};

export function stateText(s: PermState): string {
  return STATE_TEXT[s];
}

type PermName = "geolocation" | "microphone" | "camera" | "notifications";

async function webQuery(name: PermName): Promise<PermState> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
  try {
    const res = await navigator.permissions.query({ name: name as PermissionName });
    if (res.state === "granted" || res.state === "prompt" || res.state === "denied") return res.state;
    return "unknown";
  } catch {
    return "unsupported";
  }
}

/**
 * 只查询麦克风/相机的授权状态，**不打开设备**。
 * 用 getUserMedia 做探测会在页面一进来就弹系统授权框，体验很糟；
 * 真正的申请放到用户点按钮时（requestMedia）。
 */
async function probeMedia(kind: "audio" | "video"): Promise<PermState> {
  const name = kind === "audio" ? "microphone" : "camera";
  const byQuery = await webQuery(name as PermName);
  if (byQuery === "granted" || byQuery === "prompt" || byQuery === "denied") return byQuery;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "unsupported";
  return "unknown";
}

/** 真正申请设备权限：会弹系统/浏览器授权框 */
async function requestMedia(kind: "audio" | "video"): Promise<PermState> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      kind === "audio" ? { audio: true } : { video: true },
    );
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") return "denied";
    if (name === "NotFoundError" || name === "OverconstrainedError") return "unsupported";
    return "unknown";
  }
}

async function mobileGeoState(action: "check" | "request"): Promise<PermState> {
  if (!inTauri()) return webQuery("geolocation");
  try {
    const geo = await import("@tauri-apps/plugin-geolocation");
    const res =
      action === "check" ? await geo.checkPermissions() : await geo.requestPermissions(["location"]);
    const v = (res as { location?: string }).location;
    if (v === "granted") return "granted";
    if (v === "denied") return "denied";
    return "prompt";
  } catch {
    return "unknown";
  }
}

async function notificationState(action: "check" | "request"): Promise<PermState> {
  if (inTauri()) {
    try {
      const api = await import("@tauri-apps/plugin-notification");
      if (action === "check") {
        return (await api.isPermissionGranted()) ? "granted" : "prompt";
      }
      return (await api.requestPermission()) === "granted" ? "granted" : "denied";
    } catch {
      return "unknown";
    }
  }
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  if (action === "request") {
    try {
      return (await Notification.requestPermission()) === "granted" ? "granted" : "denied";
    } catch {
      return "unknown";
    }
  }
  return "prompt";
}

/** 探测某个权限在某个平台的状态 */
export async function probePermission(id: PermissionId, platform: Platform): Promise<PermState> {
  switch (id) {
    case "location":
      if (isMobile(platform)) return mobileGeoState("check");
      if (isDesktop(platform)) return "unsupported";
      return webQuery("geolocation");
    case "microphone":
      return probeMedia("audio");
    case "camera":
      return probeMedia("video");
    case "notification":
      return notificationState("check");
    case "files":
    case "network":
      return typeof navigator !== "undefined" && id === "network" ? (navigator.onLine ? "granted" : "denied") : "granted";
    default:
      return "unknown";
  }
}

/** 发起申请（会真的弹系统/浏览器对话框） */
export async function requestPermission(id: PermissionId, platform: Platform): Promise<PermState> {
  switch (id) {
    case "location":
      if (isMobile(platform)) return mobileGeoState("request");
      if (isDesktop(platform)) return "unsupported";
      if (typeof navigator === "undefined" || !navigator.geolocation) return "unsupported";
      return new Promise<PermState>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve("granted"),
          (err) => resolve(err.code === err.PERMISSION_DENIED ? "denied" : "unknown"),
          { timeout: 8000 },
        );
      });
    case "microphone":
      return requestMedia("audio");
    case "camera":
      return requestMedia("video");
    case "notification":
      return notificationState("request");
    default:
      return probePermission(id, platform);
  }
}

/**
 * 生成当前平台该显示的权限清单。
 * 平台之间的差别不只是"有没有这个权限"，还有"能不能在这里申请"。
 */
export function permissionRows(platform: Platform): PermissionRow[] {
  const desktop = isDesktop(platform);
  const mobile = isMobile(platform);
  const fix = settingsHint(platform) ?? undefined;

  const rows: PermissionRow[] = [];

  // 位置：桌面端 Tauri 插件是空实现，只能搜地点
  rows.push({
    id: "location",
    name: "位置",
    why: "给笔记打上「我在哪」的坐标，再反查地名。",
    usedBy: "位置块 · 使用当前位置",
    state: "unknown",
    canRequest: !desktop,
    note: desktop
      ? "桌面端的定位插件是空实现（只会返回 0,0），这里不提供申请；请用位置块里的「搜地点」。"
      : mobile
        ? "首次使用会弹系统定位授权，可选「仅本次」或「使用应用时允许」。"
        : "浏览器会弹地址栏授权提示。",
    fixHint: fix,
  });

  rows.push({
    id: "microphone",
    name: "麦克风",
    why: "录音存成笔记里的语音块，只存在本机。",
    usedBy: "语音块 · 录音",
    state: "unknown",
    canRequest: true,
    note: mobile
      ? "Android / iOS 首次录音会弹系统授权。"
      : desktop
        ? "桌面壳已放行 WebView 的请求；如果还是没声音，多半是系统层把它关了。"
        : undefined,
    fixHint: fix,
  });

  rows.push({
    id: "camera",
    name: "相机",
    why: "扫二维码读取链接，不拍照、不上传。",
    usedBy: "扫码对话框",
    state: "unknown",
    canRequest: true,
    note: mobile ? "用于扫码；同样会在第一次打开扫码时弹授权。" : undefined,
    fixHint: fix,
  });

  rows.push({
    id: "notification",
    name: "通知",
    why: "纪念日到期时提醒你，除此之外不打扰。",
    usedBy: "纪念日 · 到期提醒",
    state: "unknown",
    canRequest: true,
    note: mobile
      ? "Android 13 及以上需要单独授权通知，否则提醒不会出现。"
      : desktop
        ? "还要在系统的「通知」设置里允许麻雀记，否则只在应用内可见。"
        : undefined,
    fixHint: fix,
  });

  rows.push({
    id: "files",
    name: "文件读写",
    why: "备份导出走系统「保存」对话框，导入走「打开」对话框。",
    usedBy: "设置 · 导出 / 导入备份",
    state: "granted",
    canRequest: false,
    note: mobile
      ? "手机上用系统的文件选择器，不需要存储权限。"
      : "只在点导出/导入的那一刻发生，应用不会自己扫描磁盘。",
  });

  rows.push({
    id: "network",
    name: "网络",
    why: "只用于两件事：地名检索和地图瓦片。",
    usedBy: "位置块 · 搜地点 / 地图预览",
    state: "unknown",
    canRequest: false,
    note: "笔记正文、附件、备份全部在本机，不上传任何内容。",
  });

  return rows;
}
