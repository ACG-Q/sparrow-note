import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../db/notes";

export type StorageInfo = {
  /** sqlite：桌面/移动端；indexeddb：浏览器里跑 */
  kind: "sqlite" | "indexeddb";
  path: string;
  /** 一句话解释数据放在哪 */
  note: string;
};

/**
 * 数据存哪：
 * - 桌面开发版（debug 构建）→ exe 旁边
 * - 打包安装后（release 构建）→ 用户数据目录（Windows 是 %APPDATA%\com.sparrow.note）
 * - 移动端 → 应用私有目录
 * - 浏览器 → IndexedDB
 */
export async function getStorageInfo(): Promise<StorageInfo> {
  if (!isTauri()) {
    return {
      kind: "indexeddb",
      path: "IndexedDB · sparrow-note",
      note: "现在跑在浏览器里，数据存在浏览器自己的存储里。",
    };
  }
  try {
    const url = await invoke<string>("get_sqlite_url");
    const path = url.replace(/^sqlite:/, "");
    return {
      kind: "sqlite",
      path,
      note: "一个 SQLite 文件，笔记正文和附件都在里面。",
    };
  } catch {
    return { kind: "sqlite", path: "（读取失败）", note: "没能问到数据库位置。" };
  }
}
