import { useSyncExternalStore } from "react";
import { DEFAULT_MAP_PROVIDER, type MapProviderId } from "./mapProviders";

export type ReaderSize = "s" | "m" | "l";

/** 自动备份的频率 */
export type BackupInterval = "launch" | "daily" | "weekly";

/** 汇总页可以聚合哪些块：新增块类型时只加这里一行 */
export type SummaryKind =
  | "mood"
  | "contact"
  | "anniversary"
  | "location"
  | "checklist"
  | "bookmark"
  | "account"
  | "bankcard";

export interface Settings {
  readerSize: ReaderSize;
  reduceMotion: boolean;
  defaultNoteMode: "read" | "edit";
  showCardNumber: boolean;
  showMoodMeta: boolean;
  /** 汇总页启用的聚合类型，顺序即展示顺序 */
  summaryKinds: SummaryKind[];
  /** 地图瓦片源 */
  mapProvider: MapProviderId;
  /** 阅读态代码块超过多少行折叠，0 = 不折叠 */
  codeCollapseLines: number;
  /** 纪念日提醒总开关 */
  reminderEnabled: boolean;
  /** 每天几点之后提醒（0–23） */
  reminderHour: number;
  /** 提前几天提醒 */
  reminderWithinDays: number;
  /** 自动备份（写到应用数据目录的 backups/，浏览器里不可用） */
  autoBackup: boolean;
  /** 自动备份频率 */
  backupInterval: BackupInterval;
  /** 保留几份自动备份 */
  backupKeep: number;
  /** 上一次自动备份的时间戳；从没备过是 null */
  lastBackupAt: number | null;
}

const KEY = "sparrow-settings";

const ALL_SUMMARY_KINDS: SummaryKind[] = [
  "mood",
  "contact",
  "anniversary",
  "location",
  "checklist",
  "bookmark",
  "account",
  "bankcard",
];

const DEFAULTS: Settings = {
  readerSize: "m",
  reduceMotion: false,
  defaultNoteMode: "read",
  showCardNumber: false,
  showMoodMeta: true,
  // 默认只开最早支持的三样，其余让用户自己在「个性化」里加
  summaryKinds: ["mood", "contact", "anniversary"],
  mapProvider: DEFAULT_MAP_PROVIDER,
  codeCollapseLines: 14,
  reminderEnabled: true,
  reminderHour: 9,
  reminderWithinDays: 0,
  autoBackup: true,
  backupInterval: "daily",
  backupKeep: 5,
  lastBackupAt: null,
};

function sanitize(parsed: Partial<Settings>): Settings {
  const merged = { ...DEFAULTS, ...parsed };
  if (!Array.isArray(merged.summaryKinds)) merged.summaryKinds = [...DEFAULTS.summaryKinds];
  merged.summaryKinds = ALL_SUMMARY_KINDS.filter((k) => merged.summaryKinds.includes(k));
  const hour = Number(merged.reminderHour);
  merged.reminderHour = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.round(hour))) : DEFAULTS.reminderHour;
  const days = Number(merged.reminderWithinDays);
  merged.reminderWithinDays = Number.isFinite(days) ? Math.min(30, Math.max(0, Math.round(days))) : DEFAULTS.reminderWithinDays;
  merged.reminderEnabled = merged.reminderEnabled !== false;
  const lines = Number(merged.codeCollapseLines);
  merged.codeCollapseLines = Number.isFinite(lines) && lines >= 0 ? Math.min(lines, 60) : DEFAULTS.codeCollapseLines;

  merged.autoBackup = merged.autoBackup !== false;
  if (!["launch", "daily", "weekly"].includes(merged.backupInterval)) {
    merged.backupInterval = DEFAULTS.backupInterval;
  }
  const keep = Number(merged.backupKeep);
  merged.backupKeep = Number.isFinite(keep) ? Math.min(30, Math.max(1, Math.round(keep))) : DEFAULTS.backupKeep;
  const last = Number(merged.lastBackupAt);
  merged.lastBackupAt = Number.isFinite(last) && last > 0 ? last : null;
  return merged;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULTS };
    return sanitize(parsed as Partial<Settings>);
  } catch {
    return { ...DEFAULTS };
  }
}

let current: Settings = load();
const listeners = new Set<() => void>();

function apply(s: Settings): void {
  const el = document.documentElement;
  el.dataset.readerSize = s.readerSize;
  el.dataset.motion = s.reduceMotion ? "off" : "on";
}

export function initSettings(): void {
  apply(current);
}

export function getSettings(): Settings {
  return current;
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // 忽略存储失败
  }
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  current = { ...current, [key]: value };
  persist();
  apply(current);
  for (const fn of listeners) fn();
}

/** 汇总聚合的开关：打开/关闭某一类 */
export function toggleSummaryKind(kind: SummaryKind): void {
  const has = current.summaryKinds.includes(kind);
  const next = has
    ? current.summaryKinds.filter((k) => k !== kind)
    : ALL_SUMMARY_KINDS.filter((k) => k === kind || current.summaryKinds.includes(k));
  setSetting("summaryKinds", next);
}

/** 把某一类在汇总里的顺序上移/下移一格 */
export function moveSummaryKind(kind: SummaryKind, dir: -1 | 1): void {
  const list = [...current.summaryKinds];
  const i = list.indexOf(kind);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  setSetting("summaryKinds", list);
}

export const SUMMARY_KIND_META: Record<SummaryKind, { label: string; hint: string }> = {
  mood: { label: "心情", hint: "每一条心情标记和备注" },
  contact: { label: "联系人", hint: "笔记里记下的人" },
  anniversary: { label: "纪念日", hint: "生日、周年，带倒计时" },
  location: { label: "地点", hint: "去过的地方" },
  checklist: { label: "清单", hint: "待办项的完成情况" },
  bookmark: { label: "书签", hint: "收藏过的链接" },
  account: { label: "账号", hint: "记过的站点账号" },
  bankcard: { label: "银行卡", hint: "卡面信息（只记后四位）" },
};

export function allSummaryKinds(): SummaryKind[] {
  return [...ALL_SUMMARY_KINDS];
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings);
}
