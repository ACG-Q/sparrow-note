import pkg from "../../package.json";

/**
 * 「关于」页检查更新默认指向哪个仓库。
 *
 * 唯一来源是 `package.json` 的 `repository` 字段——换仓库只改一处，
 * 不用在代码里再抄一遍 owner/repo（抄两遍的那种，早晚会有一处忘了改）。
 *
 * 接受这几种写法：
 *   { "type": "git", "url": "git+https://github.com/owner/repo.git" }
 *   { "url": "https://github.com/owner/repo" }
 *   "github:owner/repo"
 *   "owner/repo"
 */
export function repoFromPackageJson(raw: unknown): string | null {
  const candidates: string[] = [];
  if (typeof raw === "string") candidates.push(raw);
  else if (raw && typeof raw === "object") {
    const o = raw as { url?: unknown; repository?: unknown };
    if (typeof o.url === "string") candidates.push(o.url);
    if (typeof o.repository === "string") candidates.push(o.repository);
  }

  for (const raw of candidates) {
    const repo = parseRepo(raw);
    if (repo) return repo;
  }
  return null;
}

/** 从各种写法里抠出 `owner/repo`；抠不出来返回 null */
export function parseRepo(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  // git+ssh://git@github.com/owner/repo.git、ssh://git@github.com/owner/repo.git
  s = s.replace(/^git\+/i, "").replace(/^(?:ssh|git):\/\//i, "https://");
  // scp 风格：git@github.com:owner/repo → https://github.com/owner/repo
  s = s.replace(/^git@github\.com:/i, "https://github.com/");
  // github:owner/repo
  if (s.startsWith("github:")) s = s.slice("github:".length);
  // 完整地址只留路径（顺手去掉可能存在的 user@）
  s = s.replace(/^https?:\/\/(?:[^@/]+@)?(?:www\.)?github\.com\//i, "");
  // 去掉 .git、查询串、锚点、末尾斜杠
  s = s.replace(/\.git$/i, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  const [owner = "", ...rest] = s.split("/");
  const repo = rest[0] ?? "";
  if (!owner || !repo) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner)) return null;
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(repo)) return null;
  return `${owner}/${repo}`;
}

/** 默认仓库；`package.json` 里没写就是空串（界面会提示去填） */
export const DEFAULT_GITHUB_REPO: string = repoFromPackageJson(
  (pkg as { repository?: unknown }).repository,
) ?? "";
