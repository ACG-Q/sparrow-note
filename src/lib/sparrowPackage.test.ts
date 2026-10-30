import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import type { NoteDoc } from "../db/notes";
import type { AppBlock } from "../editor/schema";
import {
  FORMAT_VERSION,
  PKG_SCHEMA,
  base64ToBytes,
  blockToCanonical,
  buildPackage,
  canonicalBlockToBlock,
  canonicalNoteToNote,
  createAssetSink,
  inlineToRuns,
  isValidDate,
  mergeNotes,
  noteToCanonical,
  readPackage,
  runsToInline,
  sha256Hex,
  validateNote,
} from "./sparrowPackage";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function blk(partial: Record<string, unknown>): AppBlock {
  return { id: String(partial.id ?? "b1"), children: [], props: {}, ...partial } as unknown as AppBlock;
}

/** Node 的 File 只收 ArrayBuffer 视图，Uint8Array 的 buffer 声明是 ArrayBufferLike，拷一份 */
function toFile(bytes: Uint8Array, name: string): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], name);
}

function note(overrides: Partial<NoteDoc> = {}): NoteDoc {
  return {
    id: "n1",
    title: "秋日骑行",
    date: "2026-10-20",
    createdAt: 1792483320000,
    updatedAt: 1792483320000,
    blocks: [],
    ...overrides,
  };
}

describe("行内内容", () => {
  it("保留样式与链接", () => {
    const runs = inlineToRuns([
      { type: "text", text: "普通", styles: {} },
      { type: "text", text: "加粗", styles: { bold: true, italic: true } },
      { type: "link", href: "https://example.com", content: [{ type: "text", text: "链接", styles: {} }] },
    ]);
    expect(runs).toEqual([
      { v: "普通" },
      { v: "加粗", b: true, i: true },
      { v: "链接", href: "https://example.com" },
    ]);
    const back = runsToInline(runs) as { type: string; href?: string }[];
    expect(back[0]).toMatchObject({ type: "text", text: "普通" });
    expect(back[2]).toMatchObject({ type: "link", href: "https://example.com" });
  });
});

describe("块往返", () => {
  it("段落、标题、清单、引用、勾选都保留文本", async () => {
    const sink = createAssetSink();
    const cases: [string, string][] = [
      ["paragraph", "paragraph"],
      ["heading", "heading"],
      ["quote", "quote"],
      ["bulletListItem", "bullet"],
      ["numberedListItem", "number"],
      ["checkListItem", "check"],
    ];
    for (const [noteType, kind] of cases) {
      const c = await blockToCanonical(
        blk({ type: noteType, content: [{ type: "text", text: "正文", styles: {} }], props: { level: 2, checked: true } }),
        sink,
      );
      expect(c.kind).toBe(kind);
      const back = canonicalBlockToBlock(c, () => null);
      expect(JSON.stringify(back.block)).toContain("正文");
    }
  });

  it("心情保留 emoji 与行内文本", async () => {
    const sink = createAssetSink();
    const c = await blockToCanonical(
      blk({ type: "mood", props: { emoji: "😀" }, content: [{ type: "text", text: "开心", styles: {} }] }),
      sink,
    );
    expect(c).toMatchObject({ kind: "mood", emoji: "😀", text: [{ v: "开心" }] });
  });

  it("清单块的 JSON 字符串转成数组", async () => {
    const sink = createAssetSink();
    const c = await blockToCanonical(
      blk({ type: "checklist", props: { items: JSON.stringify([{ t: "买菜", d: true }, { t: "洗碗", d: false }]) } }),
      sink,
    );
    expect(c).toMatchObject({
      kind: "checklist",
      items: [
        { text: "买菜", done: true },
        { text: "洗碗", done: false },
      ],
    });
    const back = canonicalBlockToBlock(c, () => null);
    const props = (back.block as unknown as { props: { items: string } }).props;
    expect(JSON.parse(props.items)).toEqual([
      { t: "买菜", d: true },
      { t: "洗碗", d: false },
    ]);
  });

  it("银行卡的 kind 改名成 type，还原时改回去", async () => {
    const sink = createAssetSink();
    const c = await blockToCanonical(
      blk({ type: "bankcard", props: { bank: "招商银行", no: "6225", holder: "刘雀", kind: "信用卡", theme: "rose" } }),
      sink,
    );
    expect(c).toMatchObject({ kind: "bankcard", type: "信用卡", theme: "rose" });
    const back = canonicalBlockToBlock(c, () => null);
    expect((back.block as unknown as { props: Record<string, string> }).props.kind).toBe("信用卡");
  });

  it("未知块整块塞进 raw 并能原样还原", async () => {
    const sink = createAssetSink();
    const original = blk({ type: "video-chapter", props: { start: 3 } });
    const c = await blockToCanonical(original, sink);
    expect(c.kind).toBe("unknown");
    const back = canonicalBlockToBlock(c, () => null);
    expect((back.block as unknown as { type: string }).type).toBe("video-chapter");
  });
});

describe("附件", () => {
  it("相同内容只存一份资产", async () => {
    const sink = createAssetSink();
    const a = await blockToCanonical(blk({ id: "i1", type: "image", props: { url: PNG, caption: "图一" } }), sink);
    const b = await blockToCanonical(blk({ id: "i2", type: "image", props: { url: PNG, caption: "图二" } }), sink);
    expect(a.kind === "image" && b.kind === "image" && a.asset).toBe(b.kind === "image" ? b.asset : null);
    expect(sink.files.size).toBe(1);
  });

  it("还原时把资产 id 换回 data URL", async () => {
    const sink = createAssetSink();
    const c = await blockToCanonical(blk({ type: "image", props: { url: PNG } }), sink);
    const assetId = (c as { asset: string }).asset;
    const back = canonicalBlockToBlock(c, (id) => (id === assetId ? PNG : null));
    expect((back.block as unknown as { props: { url: string } }).props.url).toBe(PNG);
  });

  it("资产缺失时降级成占位段落并计数", () => {
    const c = { id: "x", kind: "image" as const, asset: "gone.png", caption: "江边" };
    const back = canonicalBlockToBlock(c, () => null);
    expect(back.missing).toBe(true);
    expect(JSON.stringify(back.block)).toContain("附件缺失");
  });

  it("非 base64 的 data URL（svg）也能抽成附件", async () => {
    const svg = `data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg'/>")}`;
    const sink = createAssetSink();
    const c = await blockToCanonical(blk({ type: "image", props: { url: svg } }), sink);
    expect((c as { asset: string }).asset).toMatch(/\.svg$/);
    expect(sink.files.size).toBe(1);
    const back = canonicalBlockToBlock(c, () => svg);
    expect((back.block as unknown as { props: { url: string } }).props.url).toBe(svg);
    expect(back.missing).toBe(false);
  });

  it("外链地址不进资产池，原样保留", async () => {
    const sink = createAssetSink();
    const c = await blockToCanonical(
      blk({ type: "image", props: { url: "https://example.com/a.png" } }),
      sink,
    );
    expect(sink.files.size).toBe(0);
    expect(c).toMatchObject({ asset: null, src: "https://example.com/a.png" });
    const back = canonicalBlockToBlock(c, () => null);
    expect((back.block as unknown as { props: { url: string } }).props.url).toBe(
      "https://example.com/a.png",
    );
    expect(back.missing).toBe(false);
  });
});

describe("校验", () => {
  it("日期要真的合法", () => {
    expect(isValidDate("2026-10-20")).toBe(true);
    expect(isValidDate("2026-02-31")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-1-1")).toBe(false);
  });

  it("拒绝缺 id、错 schema、版本过高的笔记", () => {
    expect(validateNote(null).ok).toBe(false);
    expect(validateNote({ schema: "other", version: 1 }).ok).toBe(false);
    expect(validateNote({ schema: "sparrow/note", version: 1, id: "" }).ok).toBe(false);
    expect(validateNote({ schema: "sparrow/note", version: 99, id: "n", date: "2026-10-20", blocks: [] }).ok).toBe(false);
    expect(validateNote({ schema: "sparrow/note", version: 1, id: "n", date: "2026-10-20", blocks: [] }).ok).toBe(true);
  });
});

describe("整包", () => {
  it("打包再读回：篇数、附件去重、字段一致", async () => {
    const doc = note({
      blocks: [
        blk({ id: "p1", type: "paragraph", content: [{ type: "text", text: "开头", styles: {} }] }),
        blk({ id: "i1", type: "image", props: { url: PNG, caption: "江边" } }),
        blk({ id: "i2", type: "image", props: { url: PNG, caption: "江边二" } }),
        blk({ id: "m1", type: "mood", props: { emoji: "😀" }, content: [{ type: "text", text: "开心", styles: {} }] }),
      ],
    });
    const built = await buildPackage([doc, note({ id: "n2", title: "第二篇" })]);
    expect(built.format.schema).toBe(PKG_SCHEMA);
    expect(built.format.version).toBe(FORMAT_VERSION);
    expect(built.format.counts.notes).toBe(2);
    expect(built.format.counts.assets).toBe(1);

    const file = toFile(built.bytes, "a.sparrow");
    const read = await readPackage(file);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.notes).toHaveLength(2);
    expect(read.report.failed).toHaveLength(0);
    const first = read.notes.find((n) => n.id === "n1")!;
    expect(first.title).toBe("秋日骑行");
    expect(first.blocks).toHaveLength(4);
    const img = first.blocks[1] as unknown as { props: { url: string } };
    expect(img.props.url).toBe(PNG);
  });

  it("包里少一个资产：对应块降级，其余照常", async () => {
    const doc = note({
      blocks: [
        blk({ id: "i1", type: "image", props: { url: PNG } }),
        blk({ id: "p1", type: "paragraph", content: [{ type: "text", text: "正文", styles: {} }] }),
      ],
    });
    const built = await buildPackage([doc]);
    const entries = unzipSync(built.bytes);
    const kept: Zippable = {};
    for (const [path, data] of Object.entries(entries)) {
      if (path.startsWith("assets/")) continue; // 故意丢掉资产
      kept[path] = [data, { level: 0 }];
    }
    const broken = zipSync(kept);
    const read = await readPackage(toFile(broken, "b.sparrow"));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.report.missingAssets).toBe(1);
    expect(JSON.stringify(read.notes[0].blocks)).toContain("附件缺失");
  });

  it("校验和不匹配的文件会被跳过并报告", async () => {
    const doc = note({ blocks: [blk({ type: "paragraph", content: [{ type: "text", text: "x", styles: {} }] })] });
    const built = await buildPackage([doc]);
    const entries = unzipSync(built.bytes);
    const format = JSON.parse(strFromU8(entries["format.json"]));
    format.files = format.files.map((f: { path: string }) =>
      f.path.startsWith("notes/") ? { ...f, sha256: "0".repeat(64) } : f,
    );
    const kept: Zippable = {};
    for (const [path, data] of Object.entries(entries)) {
      kept[path] = [path === "format.json" ? strToU8(JSON.stringify(format)) : data, { level: 0 }];
    }
    const read = await readPackage(toFile(zipSync(kept), "c.sparrow"));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.notes).toHaveLength(0);
    expect(read.report.failed[0]?.reason).toContain("校验和不匹配");
  });

  it("版本太新或不是备份包时直接拒绝", async () => {
    const doc = note();
    const built = await buildPackage([doc]);
    const entries = unzipSync(built.bytes);
    const format = JSON.parse(strFromU8(entries["format.json"]));
    format.version = 9;
    const kept: Zippable = {};
    for (const [path, data] of Object.entries(entries)) {
      kept[path] = [path === "format.json" ? strToU8(JSON.stringify(format)) : data, { level: 0 }];
    }
    const tooNew = await readPackage(toFile(zipSync(kept), "d.sparrow"));
    expect(tooNew.ok).toBe(false);

    const notZip = await readPackage(toFile(strToU8("{}"), "e.sparrow"));
    expect(notZip.ok).toBe(false);
  });

  it("仅文字导出不带资产，导入后媒体变占位", async () => {
    const doc = note({ blocks: [blk({ type: "image", props: { url: PNG } })] });
    const built = await buildPackage([doc], { textOnly: true });
    expect(built.format.counts.assets).toBe(0);
    expect(Object.keys(unzipSync(built.bytes)).some((p) => p.startsWith("assets/"))).toBe(false);
    const read = await readPackage(toFile(built.bytes, "f.sparrow"));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.report.missingAssets).toBe(1);
  });
});

describe("健壮性", () => {
  it("自定义块下挂的子块也能往返", async () => {
    const sink = createAssetSink();
    const child = blk({ id: "c1", type: "paragraph", content: [{ type: "text", text: "子块", styles: {} }] });
    const parent = {
      id: "l1",
      type: "location",
      props: { name: "闻涛路", addr: "杭州" },
      content: [],
      children: [child],
    } as unknown as AppBlock;
    const c = await blockToCanonical(parent, sink);
    expect((c as { children?: unknown[] }).children).toHaveLength(1);
    const back = canonicalBlockToBlock(c, () => null);
    const kids = (back.block as unknown as { children: unknown[] }).children;
    expect(kids).toHaveLength(1);
    expect(JSON.stringify(kids[0])).toContain("子块");
  });

  it("坏字段被归一化，不会等到渲染才炸", () => {
    const r = validateNote({
      schema: "sparrow/note",
      version: 1,
      id: "n",
      date: "2026-10-20",
      blocks: [
        { id: "a", kind: "heading", level: 99 },
        { id: "b", kind: "checklist" },
        { id: "c", kind: "paragraph", text: "不是数组" },
        { id: "d", kind: "nonsense" },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [heading, checklist, para, unknown] = r.note.blocks as unknown as Record<string, unknown>[];
    expect(heading.level).toBe(6);
    expect(heading.text).toEqual([]);
    expect(checklist.items).toEqual([]);
    expect(para.text).toEqual([]);
    expect(unknown.kind).toBe("unknown");
  });

  it("清单之外的文件与重复 id 都会记 warning", async () => {
    const built = await buildPackage([note(), note({ id: "n2", title: "第二篇" })]);
    const entries = unzipSync(built.bytes);
    const kept: Zippable = {};
    for (const [path, data] of Object.entries(entries)) kept[path] = [data, { level: 0 }];
    // 再塞一份同 id 的笔记文件 + 一个清单外的文件
    const firstPath = Object.keys(entries).find((p) => p.startsWith("notes/"))!;
    const one = JSON.parse(strFromU8(entries[firstPath]));
    kept["notes/dup.json"] = [strToU8(JSON.stringify(one)), { level: 0 }];
    kept["notes/stray.txt"] = [strToU8("hi"), { level: 0 }];
    const read = await readPackage(toFile(zipSync(kept), "g.sparrow"));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.report.warnings.some((w) => w.reason.includes("同一个 id"))).toBe(true);
    expect(read.notes).toHaveLength(2);
  });
});

describe("合并", () => {
  const older = note({ id: "a", updatedAt: 1 });
  const newer = note({ id: "a", updatedAt: 2 });
  const fresh = note({ id: "b", updatedAt: 1 });

  it("合并模式：包里更新的才覆盖，更旧跳过", () => {
    expect(mergeNotes([newer], [older], "merge")).toEqual({ toWrite: [], skipped: 1 });
    expect(mergeNotes([older], [newer], "merge").toWrite[0].updatedAt).toBe(2);
    expect(mergeNotes([], [fresh], "merge").toWrite).toHaveLength(1);
  });

  it("以备份为准：一律覆盖", () => {
    expect(mergeNotes([newer], [older], "overwrite").toWrite).toHaveLength(1);
  });

  it("只补空缺：同 id 一律跳过", () => {
    const r = mergeNotes([newer], [older, fresh], "fill");
    expect(r.toWrite.map((n) => n.id)).toEqual(["b"]);
    expect(r.skipped).toBe(1);
  });
});

describe("工具", () => {
  it("base64 往返", () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 251, 252]);
    const b64 = btoa(String.fromCharCode(...bytes));
    expect(Array.from(base64ToBytes(b64))).toEqual([1, 2, 3, 250, 251, 252]);
  });

  it("sha256 稳定", async () => {
    const a = await sha256Hex(new TextEncoder().encode("麻雀记"));
    const b = await sha256Hex(new TextEncoder().encode("麻雀记"));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("canonicalNoteToNote 还原字段", async () => {
    const sink = createAssetSink();
    const c = await noteToCanonical(note({ blocks: [blk({ type: "location", props: { name: "闻涛路", addr: "杭州" } })] }), sink);
    const { note: back } = canonicalNoteToNote(c, () => null);
    expect(back.id).toBe("n1");
    expect(back.blocks[0]).toMatchObject({ type: "location", props: { name: "闻涛路", addr: "杭州" } });
  });
});
