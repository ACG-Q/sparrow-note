import { useSyncExternalStore } from "react";

export type ThemePref = "auto" | "light" | "dark";

const KEY = "sparrow-theme";
const listeners = new Set<() => void>();

function read(): ThemePref {
  if (typeof localStorage === "undefined") return "auto";
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "auto";
}

let current: ThemePref = read();

function emit(): void {
  for (const l of listeners) l();
}

export function setThemePref(pref: ThemePref): void {
  current = pref;
  localStorage.setItem(KEY, pref);
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, () => current);
}

export function resolveDark(pref: ThemePref): boolean {
  if (pref === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return pref === "dark";
}

export function nextThemePref(pref: ThemePref): ThemePref {
  return pref === "light" ? "dark" : pref === "dark" ? "auto" : "light";
}

export function themeLabel(pref: ThemePref): string {
  return pref === "light" ? "浅色" : pref === "dark" ? "深色" : "跟随系统";
}
