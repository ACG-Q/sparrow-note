import { useEffect, useMemo, useState } from "react";
import { highlightCode, LANG_LABEL, normalizeLang } from "../lib/highlight";
import { usePrefersDark } from "../lib/usePrefersDark";
import s from "./CodeBlock.module.css";

/**
 * 阅读态代码块：语法高亮 + 语言标签 + 超过 N 行折叠。
 * N 来自设置（系统设置 → 个性化 → 代码折叠），0 表示不折叠。
 */
export function CodeBlock({
  code,
  language,
  collapseLines,
}: {
  code: string;
  language: string;
  collapseLines: number;
}) {
  const dark = usePrefersDark();
  const [html, setHtml] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = code.replace(/\n+$/, "");
  const lines = useMemo(() => text.split("\n").length, [text]);
  const folding = collapseLines > 0 && lines > collapseLines;

  useEffect(() => {
    let alive = true;
    void highlightCode(text, language, dark).then((h) => {
      if (alive) setHtml(h);
    });
    return () => {
      alive = false;
    };
  }, [text, language, dark]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const langKey = normalizeLang(language);
  const label = langKey ? LANG_LABEL[langKey] ?? langKey : LANG_LABEL.text;

  return (
    <div className={s.root}>
      <div className={s.head}>
        <span className={s.lang}>{label}</span>
        <span className={s.count}>{lines} 行</span>
        <button type="button" className={s.copy} onClick={() => void copy()}>
          {copied ? "已复制" : "复制"}
        </button>
      </div>

      <div
        className={s.body}
        data-folded={folding && !open ? "1" : undefined}
        style={
          folding && !open
            ? { maxHeight: `calc(${collapseLines + 1} * 1.55em)` }
            : undefined
        }
        // Shiki 生成的 HTML 结构固定（pre > code > span）
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {folding && (
        <button type="button" className={s.more} onClick={() => setOpen((v) => !v)}>
          {open ? "收起" : `展开全部 ${lines} 行`}
        </button>
      )}
    </div>
  );
}
