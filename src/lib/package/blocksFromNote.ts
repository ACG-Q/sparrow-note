/** 块映射（正向）：BlockNote 块 → 规范块，附件抽进资产池。 */
import type { AppBlock } from "../../editor/schema";
import type { NoteDoc } from "../../db/notes";
import type { CanonicalBlock, CanonicalNote, MediaKind } from "./types";
import { FORMAT_VERSION, NOTE_SCHEMA } from "./types";
import type { AssetSink } from "./assets";
import { putAsset } from "./assets";
import { inlineToRuns, runsToPlain } from "./inline";

// ---------- 块：BlockNote -> 规范 ----------

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function parseChecklist(items: string): { text: string; done: boolean }[] {
  try {
    const raw: unknown = JSON.parse(items || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((x): x is { t: string; d: boolean } => !!x && typeof x === "object")
      .map((x) => ({ text: String((x as { t?: unknown }).t ?? ""), done: Boolean((x as { d?: unknown }).d) }));
  } catch {
    return [];
  }
}

export async function blockToCanonical(block: AppBlock, sink: AssetSink): Promise<CanonicalBlock> {
  const base = await blockToCanonicalBase(block, sink);
  const kids = (block as unknown as { children?: AppBlock[] }).children;
  if (!kids?.length) return base;
  if ((base as { children?: unknown }).children) return base;
  const converted = await Promise.all(kids.map((c) => blockToCanonical(c, sink)));
  return { ...base, children: converted } as CanonicalBlock;
}

async function blockToCanonicalBase(block: AppBlock, sink: AssetSink): Promise<CanonicalBlock> {
  const b = block as unknown as {
    id: string;
    type: string;
    props?: Record<string, unknown>;
    content?: unknown;
    children?: AppBlock[];
  };
  const id = String(b.id ?? "");
  const props = b.props ?? {};
  const children = async (): Promise<CanonicalBlock[] | undefined> => {
    if (!b.children?.length) return undefined;
    return Promise.all(b.children.map((c) => blockToCanonical(c, sink)));
  };

  switch (b.type) {
    case "paragraph":
      return { id, kind: "paragraph", text: inlineToRuns(b.content), ...(await childrenOr(children)) };
    case "heading":
      return {
        id,
        kind: "heading",
        level: Math.min(6, Math.max(1, num(props.level, 1))),
        text: inlineToRuns(b.content),
        ...(await childrenOr(children)),
      };
    case "quote":
      return { id, kind: "quote", text: inlineToRuns(b.content), ...(await childrenOr(children)) };
    case "bulletListItem":
      return { id, kind: "bullet", text: inlineToRuns(b.content), ...(await childrenOr(children)) };
    case "numberedListItem":
      return { id, kind: "number", text: inlineToRuns(b.content), ...(await childrenOr(children)) };
    case "checkListItem":
      return {
        id,
        kind: "check",
        checked: bool(props.checked),
        text: inlineToRuns(b.content),
        ...(await childrenOr(children)),
      };
    case "codeBlock":
      return {
        id,
        kind: "code",
        text: runsToPlain(inlineToRuns(b.content)),
        ...(str(props.language) ? { language: str(props.language) } : {}),
      };
    case "divider":
      return { id, kind: "divider" };
    case "table":
      return { id, kind: "table", raw: b.content ?? null };
    case "image":
    case "video":
    case "audio":
    case "file": {
      const url = str(props.url);
      const asset = await putAsset(sink, url);
      const caption = str(props.caption);
      const name = str(props.name);
      return {
        id,
        kind: b.type as MediaKind,
        asset,
        // 外链或解析不出二进制的地址原样留着，别丢
        ...(asset || !url ? {} : { src: url }),
        ...(caption ? { caption } : {}),
        ...(name ? { name } : {}),
        ...(typeof props.previewWidth === "number" ? { width: props.previewWidth } : {}),
        ...(typeof props.showPreview === "boolean" ? { showPreview: props.showPreview } : {}),
      };
    }
    case "mood":
      return {
        id,
        kind: "mood",
        emoji: str(props.emoji) || "🙂",
        text: inlineToRuns(b.content),
      };
    case "location":
      return {
        id,
        kind: "location",
        name: str(props.name),
        addr: str(props.addr),
        coord: str(props.coord),
      };
    case "contact":
      return {
        id,
        kind: "contact",
        name: str(props.name),
        phone: str(props.phone),
        relation: str(props.relation),
        email: str(props.email),
        company: str(props.company),
        title: str(props.title),
        birthday: str(props.birthday),
        note: str(props.note),
      };
    case "anniversary":
      return {
        id,
        kind: "anniversary",
        title: str(props.title),
        date: str(props.date),
        mode: str(props.kind) || "anniversary",
        annual: props.annual !== false,
      };
    case "checklist":
      return { id, kind: "checklist", items: parseChecklist(str(props.items)) };
    case "bookmark":
      return {
        id,
        kind: "bookmark",
        title: str(props.title),
        url: str(props.url),
        newTab: props.newTab !== false,
      };
    case "account":
      return {
        id,
        kind: "account",
        site: str(props.site),
        url: str(props.url),
        user: str(props.user),
        pass: str(props.pass),
        totp: str(props.totp),
        note: str(props.note),
      };
    case "bankcard":
      return {
        id,
        kind: "bankcard",
        bank: str(props.bank),
        no: str(props.no),
        holder: str(props.holder),
        type: str(props.kind) || "储蓄卡",
        theme: str(props.theme) || "blue",
      };
    case "drawing":
      return { id, kind: "drawing", asset: await putAsset(sink, str(props.data)), ...(str(props.data).startsWith("data:") ? {} : str(props.data) ? { src: str(props.data) } : {}) };
    case "voice":
      return { id, kind: "voice", asset: await putAsset(sink, str(props.url)), ...(str(props.url).startsWith("data:") ? {} : str(props.url) ? { src: str(props.url) } : {}) };
    default:
      return { id, kind: "unknown", originalType: String(b.type ?? ""), raw: b };
  }
}

async function childrenOr(fn: () => Promise<CanonicalBlock[] | undefined>): Promise<{
  children?: CanonicalBlock[];
}> {
  const kids = await fn();
  return kids && kids.length ? { children: kids } : {};
}

export async function noteToCanonical(note: NoteDoc, sink: AssetSink): Promise<CanonicalNote> {
  return {
    schema: NOTE_SCHEMA,
    version: FORMAT_VERSION,
    id: note.id,
    title: note.title,
    date: note.date,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    blocks: await Promise.all(note.blocks.map((b) => blockToCanonical(b, sink))),
  };
}
