import { compareVersions } from "./appInfo";
import { inTauri } from "./platform";

/**
 * 更新检测 —— 这里只放"接口 + 一个最小可用实现"，真正的分发服务留口子。
 *
 * 结构：
 *   UpdateSource  一个可插拔的更新源（id / 名称 / check）
 *   registerUpdateSource()  注册新源（将来接 GitHub Release、对象存储、tauri-plugin-updater）
 *   checkForUpdates()       用当前选中的源检查
 *
 * 内置源：
 *   manifest  拉一个 JSON（形如 { version, notes, url, date }），和本地版本比对
 *   github    直接调 GitHub 公开 API 读仓库的 Release
 *   disabled  未配置时用它，直接返回 unsupported（页面显示「还没配置更新源」）
 */

export type UpdateChannel = "stable" | "beta";

export type UpdateInfo = {
  version: string;
  notes?: string;
  /** 下载/详情地址 */
  url?: string;
  /** 发布日期，YYYY-MM-DD */
  date?: string;
  /** 是否强制更新 */
  mandatory?: boolean;
};

export type UpdateCheckResult =
  | { status: "latest"; current: string }
  | { status: "available"; current: string; info: UpdateInfo }
  | { status: "unsupported"; current: string; reason: string }
  | { status: "error"; current: string; reason: string };

export type UpdateSource = {
  id: string;
  label: string;
  /** 是否已配置好（比如需要 endpoint 的源） */
  ready(): boolean;
  check(current: string, channel: UpdateChannel): Promise<UpdateCheckResult>;
};

export type UpdateSettings = {
  /** 选中的更新源 id */
  source: string;
  channel: UpdateChannel;
  /** manifest 源用的地址 */
  endpoint: string;
  /** github 源用的仓库，形如 owner/repo */
  githubRepo: string;
  /** 打开应用时自动检查 */
  autoCheck: boolean;
  /** 上次检查时间戳 */
  lastCheckAt: number | null;
};

const KEY = "sparrow-update-settings";

const DEFAULT_SETTINGS: UpdateSettings = {
  source: "manifest",
  channel: "stable",
  endpoint: "",
  githubRepo: "",
  autoCheck: false,
  lastCheckAt: null,
};

export function loadUpdateSettings(): UpdateSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SETTINGS };
    const p = parsed as Partial<UpdateSettings>;
    return {
      source: typeof p.source === "string" ? p.source : DEFAULT_SETTINGS.source,
      channel: p.channel === "beta" ? "beta" : "stable",
      endpoint: typeof p.endpoint === "string" ? p.endpoint : "",
      githubRepo: typeof p.githubRepo === "string" ? p.githubRepo : "",
      autoCheck: p.autoCheck === true,
      lastCheckAt: typeof p.lastCheckAt === "number" ? p.lastCheckAt : null,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveUpdateSettings(patch: Partial<UpdateSettings>): UpdateSettings {
  const next = { ...loadUpdateSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 存不下就只在内存里生效 */
  }
  return next;
}

/**
 * 启动时要不要自动检查。
 * 两个条件缺一不可：开关打开 + 当前源真的配了东西（manifest 是地址，github 是 owner/repo）。
 * 没配置就一次请求都不发（浏览器里尤其重要），
 * 抽成纯函数，多种组合才好单测。
 */
export function shouldAutoCheck(
  settings: Pick<UpdateSettings, "autoCheck" | "endpoint"> &
    Partial<Pick<UpdateSettings, "source" | "githubRepo">>,
): boolean {
  if (settings.autoCheck !== true) return false;
  if ((settings.source ?? "manifest") === "github") {
    return normalizeGithubRepo(settings.githubRepo ?? "") !== null;
  }
  return settings.endpoint.trim().length > 0;
}

/** 校验外部 manifest（未知来源的数据，逐字段挑，不做信任） */
export function parseManifest(raw: unknown): UpdateInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const version = typeof o.version === "string" ? o.version.trim() : "";
  if (!/^\d+\.\d+\.\d+/.test(version)) return null;
  return {
    version,
    notes: typeof o.notes === "string" ? o.notes.slice(0, 2000) : undefined,
    url: typeof o.url === "string" && /^https?:\/\//.test(o.url) ? o.url : undefined,
    date: typeof o.date === "string" ? o.date.slice(0, 10) : undefined,
    mandatory: o.mandatory === true,
  };
}

/** 更新说明最多留这么多字，GitHub 的 body 可能有几万字 */
const GITHUB_NOTES_LIMIT = 2000;

/**
 * 规整用户填的仓库名：接受 `owner/repo`，也接受整条 github.com 地址（顺手去掉 .git、多余路径和查询串）。
 * 认不出来就返回 null —— 调用方据此判断"没配置"，不拿脏字符串去拼 URL。
 */
export function normalizeGithubRepo(raw: string): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(?:www\.)?github\.com\//i, "");
  s = s.replace(/[?#].*$/, "");
  s = s.replace(/\.git$/i, "");
  s = s.replace(/^\/+|\/+$/g, "");
  const [owner = "", repo = ""] = s.split("/");
  if (!owner || !repo) return null;
  // owner 是 GitHub 用户名/组织名；repo 允许点、下划线和短横线
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner)) return null;
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(repo)) return null;
  return `${owner}/${repo}`;
}

/**
 * 从 GitHub API 的响应里挑出要展示的版本，纯函数，方便单测。
 *
 * - 稳定通道：`/releases/latest` 返回一个对象，丢掉 draft
 * - 测试通道：`/releases?per_page=10` 返回数组，优先第一个 prerelease，没有就取最新那条
 * - 任何字段都当"外部数据"逐项挑，缺 tag_name / 版本号不像样就整体判为坏数据
 */
export function parseGithubRelease(raw: unknown, channel: UpdateChannel = "stable"): UpdateInfo | null {
  const release = pickGithubRelease(raw, channel);
  if (!release) return null;

  const tag = typeof release.tag_name === "string" ? release.tag_name.trim() : "";
  if (!tag) return null;
  const version = tag.replace(/^v/i, "").trim();
  // 允许 1.2、1.2.3、1.2.3-beta.1；像 "latest" 这种就别当版本号了
  if (!/^\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?$/.test(version)) return null;

  const body = typeof release.body === "string" ? release.body.trim() : "";
  const htmlUrl = typeof release.html_url === "string" ? release.html_url.trim() : "";
  const published = typeof release.published_at === "string" ? release.published_at.trim() : "";

  return {
    version,
    notes: body ? body.slice(0, GITHUB_NOTES_LIMIT) : undefined,
    url: /^https?:\/\//i.test(htmlUrl) ? htmlUrl : undefined,
    date: /^\d{4}-\d{2}-\d{2}/.test(published) ? published.slice(0, 10) : undefined,
    // GitHub 没有"必须更新"这个概念，这里恒为 false，留给 manifest 源
    mandatory: false,
  };
}

/** 按通道从单条对象 / 发布列表里挑一条；挑不出来返回 null */
function pickGithubRelease(raw: unknown, channel: UpdateChannel): Record<string, unknown> | null {
  if (Array.isArray(raw)) {
    const list = raw.filter(
      (x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x),
    );
    const usable = list.filter((r) => r.draft !== true);
    if (usable.length === 0) return null;
    if (channel === "beta") return usable.find((r) => r.prerelease === true) ?? usable[0];
    return usable.find((r) => r.prerelease !== true) ?? null;
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return o.draft === true ? null : o;
  }
  return null;
}

/**
 * 把 GitHub 的失败响应翻成人话。抽成纯函数，403 限流和 404 这类才测得到。
 * @param status HTTP 状态码
 * @param message GitHub 在 JSON 里给的 message（可能为空）
 * @param rateLimitRemaining 响应头 x-ratelimit-remaining
 */
export function githubFailureReason(
  status: number,
  message = "",
  rateLimitRemaining?: string | null,
): string {
  const detail = message.trim();
  if (status === 404) {
    return "找不到这个仓库（检查 owner/repo 有没有写对；只有测试版时，把通道切到测试版）";
  }
  if (status === 403 || status === 429) {
    const limited =
      status === 429 || rateLimitRemaining === "0" || /rate limit/i.test(detail);
    if (limited) return "GitHub 接口限流了（未登录每小时 60 次），过一会儿再检查";
    return `GitHub 拒绝访问（${status}）${detail ? `：${detail}` : ""}`;
  }
  if (status === 401) return "GitHub 需要授权（401），公开仓库的 Release 不需要令牌，请检查仓库是否私有";
  if (status >= 500) return `GitHub 服务器出错了（${status}），稍后再试`;
  return `GitHub 返回 ${status}${detail ? `：${detail}` : ""}`;
}

function githubApiUrl(repo: string, channel: UpdateChannel): string {
  const base = `https://api.github.com/repos/${repo}/releases`;
  // 测试通道要多拿几条才能找到 prerelease
  return channel === "beta" ? `${base}?per_page=10` : `${base}/latest`;
}

const sources = new Map<string, UpdateSource>();

const disabledSource: UpdateSource = {
  id: "disabled",
  label: "未配置",
  ready: () => false,
  check: async (current) => ({
    status: "unsupported",
    current,
    reason: "还没有配置更新源，等接上发布服务就能用。",
  }),
};

const manifestSource: UpdateSource = {
  id: "manifest",
  label: "更新清单（JSON）",
  ready: () => loadUpdateSettings().endpoint.trim().length > 0,
  check: async (current, channel) => {
    const endpoint = loadUpdateSettings().endpoint.trim();
    if (!endpoint) {
      return { status: "unsupported", current, reason: "还没填更新地址。" };
    }
    try {
      const sep = endpoint.includes("?") ? "&" : "?";
      const res = await fetch(`${endpoint}${sep}channel=${channel}`, { cache: "no-store" });
      if (!res.ok) return { status: "error", current, reason: `服务器返回 ${res.status}` };
      const info = parseManifest(await res.json());
      if (!info) return { status: "error", current, reason: "更新清单格式不对" };
      if (compareVersions(info.version, current) > 0) return { status: "available", current, info };
      return { status: "latest", current };
    } catch (e) {
      return { status: "error", current, reason: e instanceof Error ? e.message : "网络错误" };
    }
  },
};

const githubSource: UpdateSource = {
  id: "github",
  label: "GitHub Release",
  ready: () => normalizeGithubRepo(loadUpdateSettings().githubRepo) !== null,
  check: async (current, channel) => {
    const repo = normalizeGithubRepo(loadUpdateSettings().githubRepo);
    if (!repo) {
      return { status: "unsupported", current, reason: "还没填 GitHub 仓库（形如 owner/repo）。" };
    }

    // 失败只变成一条 reason，绝不往上抛：界面只该在状态行里看到它
    try {
      const res = await fetch(githubApiUrl(repo, channel), {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
      });

      if (!res.ok) {
        let message = "";
        try {
          const body: unknown = await res.json();
          if (body && typeof body === "object") {
            const m = (body as Record<string, unknown>).message;
            if (typeof m === "string") message = m;
          }
        } catch {
          /* 错误响应也不是 JSON 就算了，状态码本身够用 */
        }
        return {
          status: "error",
          current,
          reason: githubFailureReason(res.status, message, res.headers.get("x-ratelimit-remaining")),
        };
      }

      let json: unknown;
      try {
        json = await res.json();
      } catch {
        return { status: "error", current, reason: "GitHub 返回的内容不是合法 JSON" };
      }

      const info = parseGithubRelease(json, channel);
      if (!info) {
        return { status: "error", current, reason: "没从 GitHub 的响应里认出可用版本（缺 tag_name？）" };
      }
      if (compareVersions(info.version, current) > 0) return { status: "available", current, info };
      return { status: "latest", current };
    } catch (e) {
      const detail = e instanceof Error ? e.message : "";
      return {
        status: "error",
        current,
        reason: `连不上 GitHub（网络错误或跨域被拦）${detail ? `：${detail}` : ""}`,
      };
    }
  },
};

/** 注册一个更新源；同名会覆盖（便于将来把 manifest 源替换成 tauri-plugin-updater） */
export function registerUpdateSource(source: UpdateSource): void {
  sources.set(source.id, source);
}

export function listUpdateSources(): UpdateSource[] {
  return [...sources.values()];
}

registerUpdateSource(disabledSource);
registerUpdateSource(manifestSource);
registerUpdateSource(githubSource);

export function getSelectedSource(): UpdateSource {
  const id = loadUpdateSettings().source;
  return sources.get(id) ?? manifestSource;
}

/** 检查更新：统一入口，页面只调这个 */
export async function checkForUpdates(current: string): Promise<UpdateCheckResult> {
  const settings = loadUpdateSettings();
  const source = getSelectedSource();
  saveUpdateSettings({ lastCheckAt: Date.now() });
  return source.check(current, settings.channel);
}

/** 这个平台能不能自己安装更新（浏览器只能给下载链接） */
export function canSelfInstall(): boolean {
  return inTauri();
}
