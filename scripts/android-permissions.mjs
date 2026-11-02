#!/usr/bin/env node
/**
 * 把相机 / 麦克风的运行时权限声明补进生成的 AndroidManifest.xml。
 *
 * 为什么需要这一步：`src-tauri/gen/android` 是按需生成、且被 .gitignore 排除的；
 * 而 WebView 里的 `getUserMedia` 要能弹授权，前提是清单里声明过
 * CAMERA / RECORD_AUDIO —— 没声明时 Android 直接回绝，连系统弹窗都不出现
 * （日志里是 `None of [...RECORD_AUDIO] in {...}`），界面上就成了「点了没反应」。
 *
 * 由 tauri.conf.json 的 beforeDevCommand / beforeBuildCommand 调用：
 *   - 幂等：已经声明过就不动文件；
 *   - 桌面构建（没有 gen/android）直接跳过；
 *   - 重新 `tauri android init` 之后再构建会自动补回来，不用手工改生成目录。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 需要声明的权限：[权限名, 用途] */
export const NEEDED = [
  ["android.permission.CAMERA", "扫码"],
  ["android.permission.RECORD_AUDIO", "录音"],
  ["android.permission.MODIFY_AUDIO_SETTINGS", "录音时的音频路由"],
  // 让用户能把数据放到自己挑的文件夹（安卓 11+ 需要它才能写任意共享存储路径）
  ["android.permission.MANAGE_EXTERNAL_STORAGE", "自定义数据存放位置"],
];

const COMMENT = "    <!-- 麻雀记：扫码 / 录音（scripts/android-permissions.mjs 自动维护） -->\n";

/**
 * 在清单里补齐缺失的 uses-permission。
 * 插在已有 uses-permission 之后（Tauri 模板里这块在 <application> 之上），
 * 找不到锚点时退回插在 <manifest ...> 之后。返回新文本和真正补上的权限名。
 */
export function ensureUsesPermissions(xml, needed = NEEDED) {
  const missing = needed.filter(([name]) => !xml.includes(`android:name="${name}"`));
  if (missing.length === 0) return { xml, added: [] };

  const lines = missing.map(([name]) => `    <uses-permission android:name="${name}" />\n`).join("");
  const block = COMMENT + lines;

  const lastPerm = xml.lastIndexOf("<uses-permission");
  if (lastPerm >= 0) {
    const lineEnd = xml.indexOf("\n", lastPerm);
    if (lineEnd >= 0) {
      return {
        xml: `${xml.slice(0, lineEnd + 1)}${block}${xml.slice(lineEnd + 1)}`,
        added: missing.map(([name]) => name),
      };
    }
  }

  const manifestTag = xml.indexOf("<manifest");
  if (manifestTag >= 0) {
    const tagEnd = xml.indexOf(">", manifestTag);
    if (tagEnd >= 0) {
      return {
        xml: `${xml.slice(0, tagEnd + 1)}\n${block}${xml.slice(tagEnd + 1)}`,
        added: missing.map(([name]) => name),
      };
    }
  }

  // 兜底：结构不认识就原样返回，交给人看
  return { xml, added: [] };
}

/** 真正去改文件：给 tauri 的 beforeDevCommand / beforeBuildCommand 用 */
export function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = path.resolve(
    here,
    "..",
    "src-tauri/gen/android/app/src/main/AndroidManifest.xml",
  );

  if (!fs.existsSync(manifestPath)) {
    console.log("[android-permissions] 没有 src-tauri/gen/android，跳过（桌面构建 / 未 init）");
    return { added: [] };
  }

  const before = fs.readFileSync(manifestPath, "utf8");
  const { xml: after, added } = ensureUsesPermissions(before);
  if (added.length === 0) {
    console.log("[android-permissions] 权限声明已齐全");
    return { added };
  }
  fs.writeFileSync(manifestPath, after, "utf8");
  console.log(`[android-permissions] 补上 ${added.length} 条：${added.join("、")}`);
  return { added };
}

// 只在被直接执行时动手；被测试 import 时不做任何事
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
