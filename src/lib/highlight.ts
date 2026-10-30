import type { HighlighterCore } from "@shikijs/core";

/**
 * 阅读态的代码高亮：用 Shiki 的 JS 引擎，语言按需动态加载（不把 46 种语言全打进主包）。
 * 配色不用 github 主题，改成和「排印」纸墨一致的色板。
 */

type Loader = () => Promise<{ default: unknown }>;

// 与编辑器里 @blocknote/code-block 的语言表保持一致
const LOADERS: Record<string, Loader> = {
  c: () => import("@shikijs/langs-precompiled/c"),
  cpp: () => import("@shikijs/langs-precompiled/cpp"),
  csharp: () => import("@shikijs/langs-precompiled/csharp"),
  css: () => import("@shikijs/langs-precompiled/css"),
  glsl: () => import("@shikijs/langs-precompiled/glsl"),
  graphql: () => import("@shikijs/langs-precompiled/graphql"),
  haml: () => import("@shikijs/langs-precompiled/haml"),
  haskell: () => import("@shikijs/langs-precompiled/haskell"),
  html: () => import("@shikijs/langs-precompiled/html"),
  java: () => import("@shikijs/langs-precompiled/java"),
  javascript: () => import("@shikijs/langs-precompiled/javascript"),
  json: () => import("@shikijs/langs-precompiled/json"),
  jsonc: () => import("@shikijs/langs-precompiled/jsonc"),
  jsonl: () => import("@shikijs/langs-precompiled/jsonl"),
  jsx: () => import("@shikijs/langs-precompiled/jsx"),
  julia: () => import("@shikijs/langs-precompiled/julia"),
  kotlin: () => import("@shikijs/langs-precompiled/kotlin"),
  latex: () => import("@shikijs/langs-precompiled/latex"),
  less: () => import("@shikijs/langs-precompiled/less"),
  lua: () => import("@shikijs/langs-precompiled/lua"),
  markdown: () => import("@shikijs/langs-precompiled/markdown"),
  mdx: () => import("@shikijs/langs-precompiled/mdx"),
  mermaid: () => import("@shikijs/langs-precompiled/mermaid"),
  php: () => import("@shikijs/langs-precompiled/php"),
  postcss: () => import("@shikijs/langs-precompiled/postcss"),
  pug: () => import("@shikijs/langs-precompiled/pug"),
  python: () => import("@shikijs/langs-precompiled/python"),
  r: () => import("@shikijs/langs-precompiled/r"),
  regexp: () => import("@shikijs/langs-precompiled/regexp"),
  ruby: () => import("@shikijs/langs-precompiled/ruby"),
  rust: () => import("@shikijs/langs-precompiled/rust"),
  sass: () => import("@shikijs/langs-precompiled/sass"),
  scala: () => import("@shikijs/langs-precompiled/scala"),
  scss: () => import("@shikijs/langs-precompiled/scss"),
  shellscript: () => import("@shikijs/langs-precompiled/shellscript"),
  sql: () => import("@shikijs/langs-precompiled/sql"),
  svelte: () => import("@shikijs/langs-precompiled/svelte"),
  swift: () => import("@shikijs/langs-precompiled/swift"),
  tsx: () => import("@shikijs/langs-precompiled/tsx"),
  typescript: () => import("@shikijs/langs-precompiled/typescript"),
  vue: () => import("@shikijs/langs-precompiled/vue"),
  wasm: () => import("@shikijs/langs-precompiled/wasm"),
  wgsl: () => import("@shikijs/langs-precompiled/wgsl"),
  xml: () => import("@shikijs/langs-precompiled/xml"),
  yaml: () => import("@shikijs/langs-precompiled/yaml"),
};

const ALIASES: Record<string, string> = {
  bash: "shellscript",
  zsh: "shellscript",
  sh: "shellscript",
  shell: "shellscript",
  console: "shellscript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  py: "python",
  yml: "yaml",
  md: "markdown",
  rs: "rust",
  kt: "kotlin",
  cs: "csharp",
  htm: "html",
  "c++": "cpp",
  "objective-c": "c",
  "c#": "csharp",
  golang: "go",
  json5: "jsonc",
};

export function normalizeLang(raw: string): string {
  const l = raw.trim().toLowerCase();
  if (!l) return "";
  if (LOADERS[l]) return l;
  return ALIASES[l] ?? "";
}

/** 语言显示名（编辑器和阅读页都用它） */
export const LANG_LABEL: Record<string, string> = {
  c: "C",
  cpp: "C++",
  csharp: "C#",
  css: "CSS",
  glsl: "GLSL",
  graphql: "GraphQL",
  haml: "Haml",
  haskell: "Haskell",
  html: "HTML",
  java: "Java",
  javascript: "JavaScript",
  json: "JSON",
  jsonc: "JSONC",
  jsonl: "JSONL",
  jsx: "JSX",
  julia: "Julia",
  kotlin: "Kotlin",
  latex: "LaTeX",
  less: "Less",
  lua: "Lua",
  markdown: "Markdown",
  mdx: "MDX",
  mermaid: "Mermaid",
  php: "PHP",
  postcss: "PostCSS",
  pug: "Pug",
  python: "Python",
  r: "R",
  regexp: "RegExp",
  ruby: "Ruby",
  rust: "Rust",
  sass: "Sass",
  scala: "Scala",
  scss: "SCSS",
  shellscript: "Shell",
  sql: "SQL",
  svelte: "Svelte",
  swift: "Swift",
  tsx: "TSX",
  typescript: "TypeScript",
  vue: "Vue",
  wasm: "WASM",
  wgsl: "WGSL",
  xml: "XML",
  yaml: "YAML",
  text: "纯文本",
};

type ThemeSetting = {
  scope?: string | string[];
  settings: { foreground?: string; background?: string; fontStyle?: string };
};

const lightTheme = {
  name: "sparrow-light",
  type: "light" as const,
  colors: {
    "editor.background": "#eee9dc",
    "editor.foreground": "#191713",
  },
  settings: [
    { settings: { foreground: "#191713", background: "#eee9dc" } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#948d7e", fontStyle: "italic" },
    },
    { scope: ["string", "string.quoted", "string.template", "markup.inserted"], settings: { foreground: "#42603c" } },
    {
      scope: ["constant.numeric", "constant.language", "constant.character", "support.constant"],
      settings: { foreground: "#8a5a24" },
    },
    {
      scope: ["keyword", "keyword.control", "storage.type", "storage.modifier", "keyword.operator.new"],
      settings: { foreground: "#8a3324" },
    },
    {
      scope: ["entity.name.function", "support.function", "variable.function", "meta.function-call"],
      settings: { foreground: "#2f4f66" },
    },
    {
      scope: ["entity.name.type", "entity.name.class", "support.class", "support.type", "entity.other.inherited-class"],
      settings: { foreground: "#6b4a1f" },
    },
    { scope: ["entity.name.tag", "meta.tag.sgml"], settings: { foreground: "#8a3324" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#6b4a1f" } },
    { scope: ["variable", "variable.other", "meta.object-literal.key"], settings: { foreground: "#191713" } },
    { scope: ["punctuation", "meta.brace", "keyword.operator"], settings: { foreground: "#7a7466" } },
    { scope: ["invalid", "markup.deleted"], settings: { foreground: "#b03a2e" } },
  ] as ThemeSetting[],
};

const darkTheme = {
  name: "sparrow-dark",
  type: "dark" as const,
  colors: {
    "editor.background": "#171614",
    "editor.foreground": "#ece7da",
  },
  settings: [
    { settings: { foreground: "#ece7da", background: "#171614" } },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#7d7768", fontStyle: "italic" },
    },
    { scope: ["string", "string.quoted", "string.template", "markup.inserted"], settings: { foreground: "#9db88e" } },
    {
      scope: ["constant.numeric", "constant.language", "constant.character", "support.constant"],
      settings: { foreground: "#d0975c" },
    },
    {
      scope: ["keyword", "keyword.control", "storage.type", "storage.modifier", "keyword.operator.new"],
      settings: { foreground: "#d07257" },
    },
    {
      scope: ["entity.name.function", "support.function", "variable.function", "meta.function-call"],
      settings: { foreground: "#8aa9c0" },
    },
    {
      scope: ["entity.name.type", "entity.name.class", "support.class", "support.type", "entity.other.inherited-class"],
      settings: { foreground: "#c9a06a" },
    },
    { scope: ["entity.name.tag", "meta.tag.sgml"], settings: { foreground: "#d07257" } },
    { scope: ["entity.other.attribute-name"], settings: { foreground: "#c9a06a" } },
    { scope: ["variable", "variable.other", "meta.object-literal.key"], settings: { foreground: "#ece7da" } },
    { scope: ["punctuation", "meta.brace", "keyword.operator"], settings: { foreground: "#8a8477" } },
    { scope: ["invalid", "markup.deleted"], settings: { foreground: "#e0705c" } },
  ] as ThemeSetting[],
};

let corePromise: Promise<HighlighterCore> | null = null;
const langLoading = new Map<string, Promise<void>>();

async function getCore(): Promise<HighlighterCore> {
  if (!corePromise) {
    corePromise = (async () => {
      const [core, engine] = await Promise.all([
        import("@shikijs/core"),
        import("@shikijs/engine-javascript"),
      ]);
      return core.createHighlighterCore({
        themes: [lightTheme, darkTheme],
        langs: [],
        engine: engine.createJavaScriptRegexEngine(),
      });
    })();
  }
  return corePromise;
}

function escapeHtml(code: string): string {
  return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 高亮成 HTML；语言不认识时退化成纯文本 <pre> */
export async function highlightCode(
  code: string,
  rawLang: string,
  dark: boolean,
): Promise<string> {
  const lang = normalizeLang(rawLang);
  if (!lang) {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
  try {
    const core = await getCore();
    if (!core.getLoadedLanguages().includes(lang)) {
      let p = langLoading.get(lang);
      if (!p) {
        p = (async () => {
          const mod = (await LOADERS[lang]()) as { default: unknown };
          await core.loadLanguage(mod.default as never);
        })();
        langLoading.set(lang, p);
      }
      await p;
    }
    return core.codeToHtml(code, {
      lang,
      theme: dark ? "sparrow-dark" : "sparrow-light",
    });
  } catch {
    langLoading.delete(lang);
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}
