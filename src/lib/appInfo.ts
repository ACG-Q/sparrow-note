import pkg from "../../package.json";
import { inTauri } from "./platform";

export const APP_NAME = "麻雀记";
export const APP_ID = "com.sparrow.note";

/**
 * 当前版本。
 * 打包版以 Tauri 的真实版本为准（tauri.conf.json），
 * 浏览器里跑开发版就退回 package.json 的版本。
 */
export async function appVersion(): Promise<string> {
  if (inTauri()) {
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      return await getVersion();
    } catch {
      /* 拿不到就回退 */
    }
  }
  return pkg.version;
}

/** 版本比较：a > b 返回 1，相等 0，小于 -1。只处理 x.y.z 与 -pre 后缀 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [core, pre = ""] = v.trim().replace(/^v/i, "").split("-");
    const nums = core.split(".").map((n) => Number(n) || 0);
    return { nums, pre };
  };
  const A = parse(a);
  const B = parse(b);
  for (let i = 0; i < Math.max(A.nums.length, B.nums.length); i++) {
    const x = A.nums[i] ?? 0;
    const y = B.nums[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  // 1.0.0 > 1.0.0-beta
  if (A.pre && !B.pre) return -1;
  if (!A.pre && B.pre) return 1;
  if (A.pre === B.pre) return 0;
  return A.pre > B.pre ? 1 : -1;
}
