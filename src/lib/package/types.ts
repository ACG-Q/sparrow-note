/** 备份格式的常量与文档结构：包清单、笔记、块、行内运行的规范形态。 */

export const PKG_SCHEMA = "sparrow/backup";
export const NOTE_SCHEMA = "sparrow/note";
export const FORMAT_VERSION = 1;

/** 备份包护栏：防止「别人发来的 zip」把内存打满 */
export const MAX_PACKAGE_BYTES = 512 * 1024 * 1024; // 压缩包本体 ≤512MB
export const MAX_PACKAGE_ENTRIES = 2000; // 条目数 ≤2000
export const MAX_UNPACKED_BYTES = 200 * 1024 * 1024; // 解压后总量 ≤200MB

// ---------- 文档结构 ----------

export type Run = {
  v: string;
  b?: true;
  i?: true;
  u?: true;
  s?: true;
  c?: true;
  /** 文字色（BlockNote 的 textColor，只在非默认色时出现） */
  tc?: string;
  /** 背景色 */
  bc?: string;
  href?: string;
};

export type MediaKind = "image" | "video" | "audio" | "file";

export type CanonicalBlock =
  | { id: string; kind: "paragraph"; text: Run[]; children?: CanonicalBlock[] }
  | { id: string; kind: "heading"; level: number; text: Run[]; children?: CanonicalBlock[] }
  | { id: string; kind: "quote"; text: Run[]; children?: CanonicalBlock[] }
  | { id: string; kind: "bullet" | "number"; text: Run[]; children?: CanonicalBlock[] }
  | { id: string; kind: "check"; text: Run[]; checked: boolean; children?: CanonicalBlock[] }
  | { id: string; kind: "code"; text: string; language?: string }
  | { id: string; kind: "divider" }
  | {
      id: string;
      kind: MediaKind;
      /** 资产 id；内嵌附件才有 */
      asset: string | null;
      /** 外链地址（用户手填的 http(s) 或解不出二进制的 data URL） */
      src?: string;
      caption?: string;
      name?: string;
      width?: number;
      showPreview?: boolean;
    }
  | { id: string; kind: "table"; raw: unknown }
  | { id: string; kind: "mood"; emoji: string; text: Run[] }
  | { id: string; kind: "location"; name: string; addr: string; coord: string }
  | {
      id: string;
      kind: "contact";
      name: string;
      phone: string;
      relation: string;
      email: string;
      company: string;
      title: string;
      birthday: string;
      note: string;
    }
  | { id: string; kind: "anniversary"; title: string; date: string; mode: string; annual: boolean }
  | { id: string; kind: "checklist"; items: { text: string; done: boolean }[] }
  | { id: string; kind: "bookmark"; title: string; url: string; newTab: boolean }
  | {
      id: string;
      kind: "account";
      site: string;
      url: string;
      user: string;
      pass: string;
      totp: string;
      note: string;
    }
  | { id: string; kind: "bankcard"; bank: string; no: string; holder: string; type: string; theme: string }
  | { id: string; kind: "drawing"; asset: string | null; src?: string }
  | { id: string; kind: "voice"; asset: string | null; src?: string }
  | { id: string; kind: "unknown"; originalType: string; raw: unknown };

export type CanonicalNote = {
  schema: typeof NOTE_SCHEMA;
  version: number;
  id: string;
  title: string;
  date: string;
  createdAt: number;
  updatedAt: number;
  blocks: CanonicalBlock[];
};

export type PackageFormat = {
  schema: typeof PKG_SCHEMA;
  version: number;
  createdAt: string;
  app: { name: string; version: string };
  counts: { notes: number; assets: number; bytes: number };
  files: { path: string; bytes: number; sha256: string }[];
};

export type ImportMode = "merge" | "overwrite" | "fill";

export type ImportReport = {
  total: number;
  imported: number;
  skipped: number;
  failed: { file: string; id?: string; reason: string }[];
  warnings: { file: string; reason: string }[];
  missingAssets: number;
  unknownBlocks: number;
};
