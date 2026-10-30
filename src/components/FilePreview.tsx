import { useEffect, useRef, useState } from "react";
import { AudioPlayer } from "../editor/blocks/_shared/AudioPlayer";
import s from "./FilePreview.module.css";

export type FilePreviewTarget = { name: string; url: string };

type Kind = "image" | "video" | "audio" | "pdf" | "text" | "unsupported";

const TEXT_EXT = [
  "txt", "md", "markdown", "log", "csv", "tsv", "json", "jsonc", "yml", "yaml", "toml", "ini",
  "conf", "xml", "html", "htm", "css", "scss", "less", "js", "mjs", "cjs", "ts", "tsx", "jsx",
  "py", "rs", "go", "java", "kt", "c", "h", "cpp", "hpp", "cs", "rb", "php", "sh", "bash", "ps1",
  "sql", "svg",
];

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function mimeOf(url: string): string {
  const m = /^data:([^;,]+)/.exec(url);
  return m ? m[1].toLowerCase() : "";
}

function kindOf(name: string, url: string): Kind {
  const mime = mimeOf(url);
  if (mime.startsWith("image/") || extOf(name) === "svg") return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf" || extOf(name) === "pdf") return "pdf";
  if (mime.startsWith("text/") || TEXT_EXT.includes(extOf(name))) return "text";
  return "unsupported";
}

/** data: / blob: / http(s) 统一读成文本 */
async function readText(url: string): Promise<string> {
  const res = await fetch(url);
  return res.text();
}

function PdfView({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const render = async () => {
      try {
        const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const doc = await pdfjs.getDocument({ url }).promise;
        if (!alive) return;
        setPages(doc.numPages);
        const host = hostRef.current;
        if (!host) return;
        host.innerHTML = "";
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (!alive) return;
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(Math.max(720 / base.width, 0.6), 2.2);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "pdf-page";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          host.appendChild(canvas);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "打开失败");
      }
    };
    void render();
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div className={s.pdfWrap}>
      {error ? (
        <p className={s.error}>这个 PDF 打不开：{error}</p>
      ) : (
        <>
          {pages > 0 && <p className={s.pdfHint}>共 {pages} 页</p>}
          <div ref={hostRef} className={s.pdfPages} />
        </>
      )}
    </div>
  );
}

function TextView({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void readText(url)
      .then((t) => alive && setText(t.slice(0, 400_000)))
      .catch(() => alive && setText("读不出来"));
    return () => {
      alive = false;
    };
  }, [url]);
  if (text === null) return <p className={s.loading}>读取中…</p>;
  return <pre className={s.text}>{text}</pre>;
}

/** 文件预览：图片 / 视频 / 音频 / PDF / 文本，其它类型给下载入口 */
export function FilePreview({
  file,
  onClose,
}: {
  file: FilePreviewTarget;
  onClose: () => void;
}) {
  const kind = kindOf(file.name, file.url);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className={s.scrim} role="dialog" aria-modal="true" aria-label={file.name}>
      <header className={s.bar}>
        <span className={s.name}>{file.name}</span>
        <a className={s.download} href={file.url} download={file.name}>
          下载
        </a>
        <button type="button" className={s.close} onClick={onClose} aria-label="关闭预览">
          ✕
        </button>
      </header>

      <div className={s.stage}>
        {kind === "image" && <img className={s.image} src={file.url} alt={file.name} />}
        {kind === "video" && <video className={s.video} src={file.url} controls autoPlay playsInline />}
        {kind === "audio" && (
          <div className={s.audio}>
            <AudioPlayer src={file.url} />
          </div>
        )}
        {kind === "pdf" && <PdfView url={file.url} />}
        {kind === "text" && <TextView url={file.url} />}
        {kind === "unsupported" && (
          <div className={s.unsupported}>
            <p className={s.unsupportedTitle}>这种格式还预览不了</p>
            <p className={s.unsupportedHint}>
              目前能看：图片、视频、音频、PDF、纯文本与常见代码文件。
            </p>
            <a className={s.unsupportedBtn} href={file.url} download={file.name}>
              下载后用本地程序打开
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
