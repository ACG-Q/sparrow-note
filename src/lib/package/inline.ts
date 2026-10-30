/** 行内内容 ↔ 规范运行（runs）的双向转换。 */
import type { Run } from "./types";

// ---------- 行内内容 ----------

type InlineNode = {
  type?: string;
  text?: string;
  href?: string;
  styles?: Record<string, unknown>;
  content?: InlineNode[];
};

const STYLE_KEY: Record<string, keyof Run> = {
  bold: "b",
  italic: "i",
  underline: "u",
  strike: "s",
  code: "c",
};

function textToRun(node: InlineNode, href?: string): Run {
  const run: Run = { v: String(node.text ?? "") };
  const styles = node.styles ?? {};
  for (const [from, to] of Object.entries(STYLE_KEY)) {
    if (styles[from]) (run as Record<string, unknown>)[to] = true;
  }
  const tc = typeof styles.textColor === "string" ? styles.textColor : "";
  if (tc && tc !== "default") run.tc = tc;
  const bc = typeof styles.backgroundColor === "string" ? styles.backgroundColor : "";
  if (bc && bc !== "default") run.bc = bc;
  if (href) run.href = href;
  return run;
}

export function inlineToRuns(content: unknown): Run[] {
  if (!Array.isArray(content)) return [];
  const out: Run[] = [];
  for (const raw of content as InlineNode[]) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.type === "link") {
      for (const child of raw.content ?? []) {
        if (typeof child?.text === "string") out.push(textToRun(child, raw.href));
      }
      continue;
    }
    if (typeof raw.text === "string") out.push(textToRun(raw));
  }
  return out;
}

function runStyles(run: Run): Record<string, unknown> {
  const styles: Record<string, unknown> = {};
  for (const [from, to] of Object.entries(STYLE_KEY)) {
    if (run[to as keyof Run]) styles[from] = true;
  }
  if (run.tc) styles.textColor = run.tc;
  if (run.bc) styles.backgroundColor = run.bc;
  return styles;
}

export function runsToInline(runs: Run[]): unknown[] {
  const out: unknown[] = [];
  for (const run of runs) {
    const node = { type: "text", text: run.v, styles: runStyles(run) };
    if (run.href) {
      out.push({ type: "link", href: run.href, content: [node] });
    } else {
      out.push(node);
    }
  }
  return out;
}

export function runsToPlain(runs: Run[]): string {
  return runs.map((r) => r.v).join("");
}
