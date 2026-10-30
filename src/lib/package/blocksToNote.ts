/** 块映射（反向）：规范块 → BlockNote 块，缺失附件有占位与计数。 */
import type { AppBlock } from "../../editor/schema";
import type { NoteDoc } from "../../db/notes";
import type { CanonicalBlock, CanonicalNote } from "./types";
import { runsToInline } from "./inline";

type MediaResolver = (asset: string) => string | null;

const KIND_TO_TYPE: Record<string, string> = {
  paragraph: "paragraph",
  heading: "heading",
  quote: "quote",
  bullet: "bulletListItem",
  number: "numberedListItem",
  check: "checkListItem",
  code: "codeBlock",
  divider: "divider",
  image: "image",
  video: "video",
  audio: "audio",
  file: "file",
  table: "table",
  mood: "mood",
  location: "location",
  contact: "contact",
  anniversary: "anniversary",
  checklist: "checklist",
  bookmark: "bookmark",
  account: "account",
  bankcard: "bankcard",
  drawing: "drawing",
  voice: "voice",
};

function baseProps(): Record<string, unknown> {
  return { textAlignment: "left", backgroundColor: "default", textColor: "default" };
}

function missingPlaceholder(block: CanonicalBlock, what: string): AppBlock {
  const label = what ? `附件缺失：${what}` : "附件缺失";
  return {
    id: block.id,
    type: "paragraph",
    props: baseProps(),
    content: [{ type: "text", text: `〔${label}〕`, styles: {} }],
    children: [],
  } as unknown as AppBlock;
}

export type RestoreResult = { block: AppBlock; missing: boolean };

export function canonicalBlockToBlock(
  block: CanonicalBlock,
  resolve: MediaResolver,
): RestoreResult {
  const base = canonicalBlockToBlockBase(block, resolve);
  const kids = (block as { children?: CanonicalBlock[] }).children;
  if (!kids?.length) return base;
  const target = base.block as unknown as { children?: unknown[] };
  if (Array.isArray(target.children) && target.children.length > 0) return base;
  const childResults = kids.map((c) => canonicalBlockToBlock(c, resolve));
  target.children = childResults.map((r) => r.block);
  return { block: base.block, missing: base.missing || childResults.some((r) => r.missing) };
}

function canonicalBlockToBlockBase(
  block: CanonicalBlock,
  resolve: MediaResolver,
): RestoreResult {
  const id = block.id;
  const kids = (block as { children?: CanonicalBlock[] }).children;
  const children = kids?.map((c) => canonicalBlockToBlock(c, resolve));
  const childBlocks = children?.map((c) => c.block) ?? [];
  const missing = children?.some((c) => c.missing) ?? false;

  const withChildren = (extra: Record<string, unknown>) => ({
    id,
    props: { ...baseProps() },
    children: childBlocks,
    ...extra,
  });

  switch (block.kind) {
    case "paragraph":
    case "quote":
    case "bullet":
    case "number":
      return {
        missing,
        block: withChildren({
          type: KIND_TO_TYPE[block.kind],
          content: runsToInline(block.text),
        }) as unknown as AppBlock,
      };
    case "heading":
      return {
        missing,
        block: withChildren({
          type: "heading",
          props: { ...baseProps(), level: block.level, isToggleable: false },
          content: runsToInline(block.text),
        }) as unknown as AppBlock,
      };
    case "check":
      return {
        missing,
        block: withChildren({
          type: "checkListItem",
          props: { ...baseProps(), checked: block.checked },
          content: runsToInline(block.text),
        }) as unknown as AppBlock,
      };
    case "code":
      return {
        missing,
        block: {
          id,
          type: "codeBlock",
          props: { ...baseProps(), language: block.language ?? "text" },
          content: block.text ? [{ type: "text", text: block.text, styles: {} }] : [],
          children: [],
        } as unknown as AppBlock,
      };
    case "divider":
      return {
        missing,
        block: { id, type: "divider", props: baseProps(), content: undefined, children: [] } as unknown as AppBlock,
      };
    case "table":
      return {
        missing,
        block: {
          id,
          type: "table",
          props: baseProps(),
          content: block.raw,
          children: [],
        } as unknown as AppBlock,
      };
    case "image":
    case "video":
    case "audio":
    case "file": {
      const src = "src" in block ? block.src : undefined;
      const url = block.asset ? resolve(block.asset) : (src ?? null);
      if (!url) return { missing: true, block: missingPlaceholder(block, block.caption || block.asset || "") };
      return {
        missing,
        block: {
          id,
          type: block.kind,
          props: {
            ...baseProps(),
            url,
            caption: block.caption ?? "",
            name: block.name ?? "",
            showPreview: block.showPreview ?? true,
            ...(block.kind === "image" ? { previewWidth: block.width ?? 512 } : {}),
          },
          content: [],
          children: [],
        } as unknown as AppBlock,
      };
    }
    case "mood":
      return {
        missing,
        block: {
          id,
          type: "mood",
          props: { ...baseProps(), emoji: block.emoji },
          content: runsToInline(block.text),
          children: [],
        } as unknown as AppBlock,
      };
    case "location":
      return {
        missing,
        block: {
          id,
          type: "location",
          props: { ...baseProps(), name: block.name, addr: block.addr, coord: block.coord },
          content: [],
          children: [],
        } as unknown as AppBlock,
      };
    case "contact":
      return {
        missing,
        block: {
          id,
          type: "contact",
          props: {
            ...baseProps(),
            name: block.name,
            phone: block.phone,
            relation: block.relation,
            email: block.email,
            company: block.company,
            title: block.title,
            birthday: block.birthday,
            note: block.note,
          },
          content: [],
          children: [],
        } as unknown as AppBlock,
      };
    case "anniversary":
      return {
        missing,
        block: {
          id,
          type: "anniversary",
          props: { ...baseProps(), title: block.title, date: block.date, kind: block.mode, annual: block.annual },
          content: [],
          children: [],
        } as unknown as AppBlock,
      };
    case "checklist":
      return {
        missing,
        block: {
          id,
          type: "checklist",
          props: {
            ...baseProps(),
            items: JSON.stringify(block.items.map((i) => ({ t: i.text, d: i.done }))),
          },
          content: [],
          children: [],
        } as unknown as AppBlock,
      };
    case "bookmark":
      return {
        missing,
        block: {
          id,
          type: "bookmark",
          props: { ...baseProps(), title: block.title, url: block.url, newTab: block.newTab },
          content: [],
          children: [],
        } as unknown as AppBlock,
      };
    case "account":
      return {
        missing,
        block: {
          id,
          type: "account",
          props: {
            ...baseProps(),
            site: block.site,
            url: block.url,
            user: block.user,
            pass: block.pass,
            totp: block.totp,
            note: block.note,
          },
          content: [],
          children: [],
        } as unknown as AppBlock,
      };
    case "bankcard":
      return {
        missing,
        block: {
          id,
          type: "bankcard",
          props: {
            ...baseProps(),
            bank: block.bank,
            no: block.no,
            holder: block.holder,
            kind: block.type,
            theme: block.theme,
          },
          content: [],
          children: [],
        } as unknown as AppBlock,
      };
    case "drawing": {
      const url = block.asset ? resolve(block.asset) : (block.src ?? null);
      if (!url) return { missing: true, block: missingPlaceholder(block, "手绘") };
      return {
        missing,
        block: {
          id,
          type: "drawing",
          props: { ...baseProps(), data: url },
          content: [],
          children: [],
        } as unknown as AppBlock,
      };
    }
    case "voice": {
      const url = block.asset ? resolve(block.asset) : (block.src ?? null);
      if (!url) return { missing: true, block: missingPlaceholder(block, "语音") };
      return {
        missing,
        block: {
          id,
          type: "voice",
          props: { ...baseProps(), url },
          content: [],
          children: [],
        } as unknown as AppBlock,
      };
    }
    default: {
      const raw = (block as { raw?: unknown }).raw;
      if (raw && typeof raw === "object") return { missing, block: raw as AppBlock };
      return { missing: true, block: missingPlaceholder(block, "未知块") };
    }
  }
}

export function canonicalNoteToNote(
  note: CanonicalNote,
  resolve: MediaResolver,
): { note: NoteDoc; missing: number; unknown: number } {
  let missing = 0;
  let unknown = 0;
  const blocks = note.blocks.map((b) => {
    if (b.kind === "unknown") unknown += 1;
    const r = canonicalBlockToBlock(b, resolve);
    if (r.missing) missing += 1;
    return r.block;
  });
  return {
    note: {
      id: note.id,
      title: note.title,
      date: note.date,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      blocks,
    },
    missing,
    unknown,
  };
}
