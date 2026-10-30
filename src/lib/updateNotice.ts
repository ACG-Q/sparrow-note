import { useSyncExternalStore } from "react";
import { appVersion } from "./appInfo";
import {
  checkForUpdates,
  loadUpdateSettings,
  shouldAutoCheck,
  type UpdateInfo,
} from "./updates";

/**
 * 「发现新版本」的轻量提示状态。
 *
 * 启动时自动检查只往这里记一条，不弹窗、不跳页、不打断任何事；
 * 「我的 → 关于」那一行的角标和关于页里的提示都读这个 store。
 *
 * 用一个模块级 store + 订阅，而不是 Context：只为一个可空对象铺 Provider 不划算，
 * 自动检查又发生在 React 之外（启动阶段），模块级反而接得更直。
 */

let notice: UpdateInfo | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function getUpdateNotice(): UpdateInfo | null {
  return notice;
}

export function setUpdateNotice(info: UpdateInfo | null): void {
  notice = info;
  emit();
}

export function clearUpdateNotice(): void {
  if (notice === null) return;
  notice = null;
  emit();
}

export function subscribeUpdateNotice(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 组件里读「有没有发现新版本」 */
export function useUpdateNotice(): UpdateInfo | null {
  return useSyncExternalStore(subscribeUpdateNotice, getUpdateNotice, getUpdateNotice);
}

/** 首屏先画完再悄悄问一句；这个延迟也是「不阻塞首屏」的落点 */
export const AUTO_CHECK_DELAY_MS = 1500;

let started = false;

/**
 * 启动阶段的自动检查，整个进程只跑一次。
 *
 * - 没开 autoCheck、或没填更新地址 → 连定时器都不排，一次请求都不发
 * - 任何失败（网络、跨域、清单格式、版本读取）都吞掉，用户看不到
 * - 只有 status === "available" 才写 store，其余情况什么都不做
 */
export function startAutoUpdateCheck(delayMs = AUTO_CHECK_DELAY_MS): void {
  if (started) return;
  started = true;
  try {
    if (!shouldAutoCheck(loadUpdateSettings())) return;
    window.setTimeout(() => {
      void runAutoCheck();
    }, delayMs);
  } catch {
    /* 自动检查不值得打扰用户：读设置失败就当没这回事 */
  }
}

async function runAutoCheck(): Promise<void> {
  try {
    const current = await appVersion();
    const result = await checkForUpdates(current);
    if (result.status === "available") setUpdateNotice(result.info);
  } catch {
    /* 静默 */
  }
}
