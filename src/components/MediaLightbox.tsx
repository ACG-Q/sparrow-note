import { useEffect, useState } from "react";
import { saveImageAs } from "../lib/download";
import s from "./MediaLightbox.module.css";

export type PreviewMedia = {
  kind: "image" | "video";
  url: string;
  caption?: string;
};

/** 全屏预览：图片/视频铺满整页，点背景或 Esc 关闭 */
export function MediaLightbox({ media, onClose }: { media: PreviewMedia; onClose: () => void }) {
  const [saved, setSaved] = useState(false);

  const save = async () => {
    try {
      await saveImageAs(media.url, media.caption || "图片");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch {
      setSaved(false);
    }
  };

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
    <div
      className={s.scrim}
      role="dialog"
      aria-modal="true"
      aria-label={media.caption || "预览"}
      onClick={onClose}
    >
      <div className={s.tools}>
        {media.kind === "image" && (
          <button type="button" className={s.tool} onClick={() => void save()}>
            {saved ? "已保存" : "存为图片"}
          </button>
        )}
        <button type="button" className={s.close} onClick={onClose} aria-label="关闭预览">
          ✕
        </button>
      </div>
      <figure className={s.stage} onClick={(e) => e.stopPropagation()}>
        {media.kind === "image" ? (
          <img className={s.media} src={media.url} alt={media.caption || "预览"} />
        ) : (
          <video className={s.media} src={media.url} controls autoPlay playsInline />
        )}
        {media.caption ? <figcaption className={s.caption}>{media.caption}</figcaption> : null}
      </figure>
    </div>
  );
}
