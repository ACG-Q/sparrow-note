/** 导入前的校验：把任意 JSON 收窄成合法笔记，坏数据给出可读原因。 */
import type { CanonicalBlock, CanonicalNote, Run } from "./types";
import { FORMAT_VERSION, NOTE_SCHEMA } from "./types";

// ---------- 校验 ----------

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** 把外部文件里的块整理成能安全渲染的形状：缺字段补默认，类型不对就纠正 */
function normalizeRuns(raw: unknown): Run[] {
  if (!Array.isArray(raw)) return [];
  const out: Run[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const run: Run = { v: typeof r.v === "string" ? r.v : String(r.v ?? "") };
    for (const k of ["b", "i", "u", "s", "c"] as const) if (r[k]) run[k] = true;
    if (typeof r.tc === "string" && r.tc) run.tc = r.tc;
    if (typeof r.bc === "string" && r.bc) run.bc = r.bc;
    if (typeof r.href === "string" && r.href) run.href = r.href;
    out.push(run);
  }
  return out;
}

const asString = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const asNumber = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const asBool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d);

function normalizeBlock(raw: Record<string, unknown>): CanonicalBlock {
  const id = asString(raw.id) || `b-${Math.random().toString(36).slice(2, 10)}`;
  const kind = asString(raw.kind);
  const kids = Array.isArray(raw.children)
    ? (raw.children as Record<string, unknown>[]).map(normalizeBlock)
    : [];
  const attach = <T extends CanonicalBlock>(b: T): T =>
    kids.length ? ({ ...b, children: kids } as T) : b;

  switch (kind) {
    case "paragraph":
    case "quote":
    case "bullet":
    case "number":
      return attach({ id, kind, text: normalizeRuns(raw.text) } as CanonicalBlock);
    case "heading":
      return attach({
        id,
        kind: "heading",
        level: Math.min(6, Math.max(1, Math.round(asNumber(raw.level, 1)))),
        text: normalizeRuns(raw.text),
      } as CanonicalBlock);
    case "check":
      return attach({
        id,
        kind: "check",
        text: normalizeRuns(raw.text),
        checked: asBool(raw.checked),
      } as CanonicalBlock);
    case "code":
      return { id, kind: "code", text: asString(raw.text), ...(raw.language ? { language: asString(raw.language) } : {}) };
    case "divider":
      return { id, kind: "divider" };
    case "table":
      return { id, kind: "table", raw: raw.raw ?? null };
    case "image":
    case "video":
    case "audio":
    case "file":
      return attach({
        id,
        kind,
        asset: typeof raw.asset === "string" && raw.asset ? raw.asset : null,
        ...(typeof raw.src === "string" && raw.src ? { src: raw.src } : {}),
        ...(typeof raw.caption === "string" && raw.caption ? { caption: raw.caption } : {}),
        ...(typeof raw.name === "string" && raw.name ? { name: raw.name } : {}),
        ...(typeof raw.width === "number" ? { width: raw.width } : {}),
        ...(typeof raw.showPreview === "boolean" ? { showPreview: raw.showPreview } : {}),
      } as CanonicalBlock);
    case "mood":
      return attach({ id, kind: "mood", emoji: asString(raw.emoji) || "🙂", text: normalizeRuns(raw.text) } as CanonicalBlock);
    case "location":
      return attach({
        id,
        kind: "location",
        name: asString(raw.name),
        addr: asString(raw.addr),
        coord: asString(raw.coord),
      } as CanonicalBlock);
    case "contact":
      return attach({
        id,
        kind: "contact",
        name: asString(raw.name),
        phone: asString(raw.phone),
        relation: asString(raw.relation),
        email: asString(raw.email),
        company: asString(raw.company),
        title: asString(raw.title),
        birthday: asString(raw.birthday),
        note: asString(raw.note),
      } as CanonicalBlock);
    case "anniversary":
      return attach({
        id,
        kind: "anniversary",
        title: asString(raw.title),
        date: asString(raw.date),
        mode: asString(raw.mode) || "anniversary",
        annual: asBool(raw.annual, true),
      } as CanonicalBlock);
    case "checklist": {
      const items = Array.isArray(raw.items)
        ? (raw.items as Record<string, unknown>[])
            .filter((x) => x && typeof x === "object")
            .map((x) => ({ text: asString(x.text), done: asBool(x.done) }))
        : [];
      return attach({ id, kind: "checklist", items } as CanonicalBlock);
    }
    case "bookmark":
      return attach({
        id,
        kind: "bookmark",
        title: asString(raw.title),
        url: asString(raw.url),
        newTab: asBool(raw.newTab, true),
      } as CanonicalBlock);
    case "account":
      return attach({
        id,
        kind: "account",
        site: asString(raw.site),
        url: asString(raw.url),
        user: asString(raw.user),
        pass: asString(raw.pass),
        totp: asString(raw.totp),
        note: asString(raw.note),
      } as CanonicalBlock);
    case "bankcard":
      return attach({
        id,
        kind: "bankcard",
        bank: asString(raw.bank),
        no: asString(raw.no),
        holder: asString(raw.holder),
        type: asString(raw.type) || "储蓄卡",
        theme: asString(raw.theme) || "blue",
      } as CanonicalBlock);
    case "drawing":
      return {
        id,
        kind: "drawing",
        asset: typeof raw.asset === "string" && raw.asset ? raw.asset : null,
        ...(typeof raw.src === "string" && raw.src ? { src: raw.src } : {}),
      };
    case "voice":
      return {
        id,
        kind: "voice",
        asset: typeof raw.asset === "string" && raw.asset ? raw.asset : null,
        ...(typeof raw.src === "string" && raw.src ? { src: raw.src } : {}),
      };
    case "unknown":
      return { id, kind: "unknown", originalType: asString(raw.originalType), raw: raw.raw ?? null };
    default:
      // 不认识的 kind 也留着，尽量原样还原
      return { id, kind: "unknown", originalType: kind, raw: raw.raw ?? raw };
  }
}

export type NoteValidation = { ok: true; note: CanonicalNote } | { ok: false; reason: string };

export function validateNote(raw: unknown): NoteValidation {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "不是对象" };
  const n = raw as Record<string, unknown>;
  if (n.schema !== NOTE_SCHEMA) return { ok: false, reason: `schema 不是 ${NOTE_SCHEMA}` };
  if (typeof n.version !== "number" || n.version > FORMAT_VERSION) {
    return { ok: false, reason: `笔记版本 ${String(n.version)} 不受支持` };
  }
  if (typeof n.id !== "string" || !n.id.trim()) return { ok: false, reason: "id 缺失" };
  if (typeof n.date !== "string" || !isValidDate(n.date)) return { ok: false, reason: "date 不是合法日期" };
  if (!Array.isArray(n.blocks)) return { ok: false, reason: "blocks 不是数组" };

  const blocks: CanonicalBlock[] = [];
  for (const [i, b] of (n.blocks as unknown[]).entries()) {
    if (!b || typeof b !== "object") return { ok: false, reason: `第 ${i + 1} 个块不是对象` };
    const blk = b as Record<string, unknown>;
    if (typeof blk.id !== "string" || !blk.id) return { ok: false, reason: `第 ${i + 1} 个块缺 id` };
    if (typeof blk.kind !== "string" || !blk.kind) return { ok: false, reason: `第 ${i + 1} 个块缺 kind` };
    blocks.push(normalizeBlock(blk));
  }

  const now = Date.now();
  return {
    ok: true,
    note: {
      schema: NOTE_SCHEMA,
      version: FORMAT_VERSION,
      id: n.id,
      title: typeof n.title === "string" ? n.title : "",
      date: n.date,
      createdAt: typeof n.createdAt === "number" ? n.createdAt : now,
      updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : now,
      blocks,
    },
  };
}
