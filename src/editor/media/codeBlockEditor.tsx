import { useEffect, useMemo, useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { codeBlockOptions } from "@blocknote/code-block";
import { FloatingPanel } from "../blocks/_shared/FloatingPanel";
import s from "./codeBlockEditor.module.css";

type Lang = { name: string; aliases: string[] };

const LANGS = Object.entries(codeBlockOptions.supportedLanguages as Record<string, Lang>).map(
  ([id, meta]) => ({ id, label: meta.name || id }),
);

const LANG_ALIAS: Record<string, string> = {};
for (const [id, meta] of Object.entries(codeBlockOptions.supportedLanguages as Record<string, Lang>)) {
  for (const a of meta.aliases ?? []) LANG_ALIAS[a.toLowerCase()] = id;
}

function resolveLang(raw: string): string {
  const v = (raw || "").toLowerCase();
  if (LANGS.some((l) => l.id === v)) return v;
  return LANG_ALIAS[v] ?? "text";
}



function CodeBlockShell({
  block,
  editor,
  contentRef,
}: {
  block: { props: { language: string }; content?: unknown };
  editor: {
    updateBlock: (b: unknown, u: { props: { language: string } }) => void;
    prosemirrorView?: {
      state: { tr: { insertText(t: string): { scrollIntoView(): unknown } } };
      dispatch: (tr: unknown) => void;
    };
  };
  contentRef: (node: HTMLElement | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [lines, setLines] = useState(1);
  const [langOpen, setLangOpen] = useState(false);
  const [query, setQuery] = useState("");
  const langBtnRef = useRef<HTMLButtonElement | null>(null);
  const codeRef = useRef<HTMLElement | null>(null);
  const lang = resolveLang(block.props.language);
  const current = LANGS.find((l) => l.id === lang);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGS;
    return LANGS.filter(
      (l) => l.label.toLowerCase().includes(q) || l.id.includes(q),
    );
  }, [query]);

  const choose = (id: string) => {
    editor.updateBlock(block, { props: { language: id } });
    setLangOpen(false);
    setQuery("");
  };

  // 行数直接从 DOM 数（plain content 的 block.content 拿不到实时文本）
  useEffect(() => {
    const el = codeRef.current;
    if (!el) return;
    const update = () => {
      const text = (el.textContent || "").replace(/\n+$/, "");
      setLines(text ? text.split("\n").length : 1);
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  const attach = (node: HTMLElement | null) => {
    codeRef.current = node;
    contentRef(node);
  };

  // Enter/Tab 在捕获阶段拦下：走 ProseMirror 事务直接插字符，
  // 否则 Enter 会把代码块拆成两个块。
  // 光标落在编辑器根节点上（不在 <code> 里），所以监听挂 document，
  // 再用选区判断「这次按键是不是发生在本块的代码里」。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = codeRef.current;
      if (!el) return;
      const node = window.getSelection()?.anchorNode ?? null;
      if (!node || !el.contains(node)) return;
      const view = editor.prosemirrorView;
      if (!view) return;
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        view.dispatch(view.state.tr.insertText("\n").scrollIntoView());
      } else if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        view.dispatch(view.state.tr.insertText("  ").scrollIntoView());
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editor]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codeRef.current?.textContent ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={s.card}>
      {/* 工具条不可编辑，但 <code> 必须保留可编辑：代码正文就渲染在里面 */}
      <div className={s.head} contentEditable={false}>
        <button
          type="button"
          ref={langBtnRef}
          className={s.langBtn}
          onClick={() => {
            setLangOpen((v) => !v);
            setQuery("");
          }}
          aria-label="代码语言"
          aria-expanded={langOpen}
        >
          {current?.label ?? "Plain Text"}
          <span className={s.caret} aria-hidden="true" />
        </button>
        <span className={s.count}>{lines} 行</span>
        <button type="button" className={s.copy} onClick={() => void copy()}>
          {copied ? "已复制" : "复制"}
        </button>
      </div>

      {langOpen && (
        <FloatingPanel anchor={langBtnRef.current} width={236} onClose={() => setLangOpen(false)}>
          <div className={s.langPanel}>
            <input
              className={s.langSearch}
              value={query}
              autoFocus
              placeholder="搜索语言，如 py / rust"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setLangOpen(false);
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const pick = filtered[0];
                  if (pick) choose(pick.id);
                }
              }}
            />
            <ul className={s.langList}>
              {filtered.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className={l.id === lang ? `${s.langItem} ${s.langItemOn}` : s.langItem}
                    onClick={() => choose(l.id)}
                  >
                    {l.label}
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className={s.langEmpty}>没有匹配的语言</li>}
            </ul>
          </div>
        </FloatingPanel>
      )}

      <pre className={s.body}>
        <code ref={attach} className={s.code} />
      </pre>
    </div>
  );
}

/**
 * 替换默认的 codeBlock：上面一条工具条（语言 / 行数 / 复制），下面才是代码。
 * 类型仍是 codeBlock、内容仍是 plain，老笔记不用迁移。
 */
export const CodeBlockEditor = createReactBlockSpec(
  {
    type: "codeBlock",
    propSchema: { language: { default: "text" } },
    content: "plain",
  },
  {
    meta: {
      code: true,
      defining: true,
      isolating: false,
      highlight: (b: { props: { language: string } }) => b.props.language,
    },
    render: ({ block, editor, contentRef }) => (
      <CodeBlockShell
        block={block as unknown as { props: { language: string }; content?: unknown }}
        editor={editor as unknown as {
          updateBlock: (b: unknown, u: { props: { language: string } }) => void;
        }}
        contentRef={contentRef}
      />
    ),
  },
);
