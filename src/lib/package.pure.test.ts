import { describe, expect, it } from "vitest";
import { bytesToBase64, base64ToBytes, extForMime, mimeForExt, parseDataUrl, toDataUrl } from "./package/bytes";
import { inlineToRuns, runsToInline, runsToPlain } from "./package/inline";
import { mergeNotes } from "./package/merge";
import { validateNote } from "./package/validate";

/**
 * 备份包里的纯函数：编解码、行内转换、导入校验、三种合并策略。
 * 这些是数据进出的关口，边界情况比正常路径更值得测。
 */

describe("bytes：base64 / data URL / MIME", () => {
  it("base64 往返", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });

  it("空数组也能往返", () => {
    expect([...base64ToBytes(bytesToBase64(new Uint8Array()))]).toEqual([]);
  });

  it("data URL 能解析出 mime 与字节", () => {
    const url = toDataUrl("image/png", new Uint8Array([1, 2, 3]));
    const parts = parseDataUrl(url);
    expect(parts?.mime).toBe("image/png");
    expect([...(parts?.bytes ?? [])]).toEqual([1, 2, 3]);
  });

  it("非法 data URL 返回 null", () => {
    expect(parseDataUrl("https://a.com/x.png")).toBeNull();
    expect(parseDataUrl("data:")).toBeNull();
    expect(parseDataUrl("")).toBeNull();
  });

  it("mime ↔ 后缀互转，未知 mime 给兜底", () => {
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("application/x-未知")).toBeTruthy();
    expect(mimeForExt("png")).toBe("image/png");
    expect(mimeForExt("zzz")).toBeTruthy();
  });
});

describe("inline：runs 往返", () => {
  it("文本 + 样式转成 runs 再转回来", () => {
    const content = [
      { type: "text", text: "普通", styles: {} },
      { type: "text", text: "加粗", styles: { bold: true } },
    ];
    const runs = inlineToRuns(content);
    expect(runsToPlain(runs)).toBe("普通加粗");
    const back = runsToInline(runs) as { type: string; text?: string }[];
    expect(back.some((n) => n.text === "加粗")).toBe(true);
  });

  it("链接保留 href", () => {
    const runs = inlineToRuns([
      { type: "link", href: "https://a.com", content: [{ type: "text", text: "点这里", styles: {} }] },
    ]);
    expect(runsToPlain(runs)).toContain("点这里");
    const back = runsToInline(runs) as { type: string; href?: string }[];
    expect(back.some((n) => n.href === "https://a.com")).toBe(true);
  });

  it("坏输入返回空", () => {
    expect(inlineToRuns(undefined)).toEqual([]);
    expect(inlineToRuns("不是数组")).toEqual([]);
    expect(runsToPlain([])).toBe("");
    expect(runsToInline([])).toEqual([]);
  });
});

describe("merge：三种导入策略", () => {
  const note = (id: string, updatedAt: number) => ({
    id,
    title: id,
    date: "2026-10-30",
    createdAt: 1,
    updatedAt,
    blocks: [],
  });

  it("merge：新的覆盖旧的，旧的跳过", () => {
    const local = [note("a", 1), note("b", 5)];
    const incoming = [note("a", 9), note("b", 2)];
    const { toWrite, skipped } = mergeNotes(local as never, incoming as never, "merge");
    expect(toWrite.map((n) => n.id)).toEqual(["a"]);
    expect(skipped).toBe(1);
  });

  it("fill：只补库里没有的", () => {
    const local = [note("a", 1)];
    const { toWrite, skipped } = mergeNotes(
      local as never,
      [note("a", 9), note("c", 1)] as never,
      "fill",
    );
    expect(toWrite.map((n) => n.id)).toEqual(["c"]);
    expect(skipped).toBe(1);
  });

  it("overwrite：无条件覆盖", () => {
    const local = [note("a", 9)];
    const { toWrite } = mergeNotes(local as never, [note("a", 1)] as never, "overwrite");
    expect(toWrite[0].updatedAt).toBe(1);
  });

  it("空列表不出错", () => {
    expect(mergeNotes([], [], "merge")).toEqual({ toWrite: [], skipped: 0 });
  });
});

describe("validateNote：导入前校验", () => {
  const good = {
    schema: "sparrow/note",
    version: 1,
    id: "n1",
    title: "标题",
    date: "2026-10-30",
    createdAt: 1,
    updatedAt: 1,
    blocks: [{ id: "b1", kind: "paragraph", content: [{ v: "正文" }] }],
  };

  it("合法笔记通过并补默认值", () => {
    const r = validateNote(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.note.id).toBe("n1");
      expect(r.note.date).toBe("2026-10-30");
    }
  });

  it("不是对象 → 拒绝", () => {
    expect(validateNote(null).ok).toBe(false);
    expect(validateNote("x").ok).toBe(false);
  });

  it("schema / version / id / date / blocks 逐项校验", () => {
    const cases = [
      { ...good, schema: "别的" },
      { ...good, version: 999 },
      { ...good, id: "" },
      { ...good, date: "2026-13-40" },
      { ...good, blocks: "不是数组" },
    ];
    for (const c of cases) {
      const r = validateNote(c);
      expect(r.ok).toBe(false);
    }
  });

  it("块缺 id 或 kind → 拒绝并指出第几个", () => {
    const r1 = validateNote({ ...good, blocks: [{ kind: "paragraph" }] });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toContain("1");
    const r2 = validateNote({ ...good, blocks: [{ id: "b", }] });
    expect(r2.ok).toBe(false);
  });

  it("标题缺失时补空串，时间戳缺失时补当前时间", () => {
    const r = validateNote({ ...good, title: undefined, createdAt: undefined, updatedAt: undefined });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.note.title).toBe("");
      expect(r.note.createdAt).toBeGreaterThan(0);
    }
  });
});
