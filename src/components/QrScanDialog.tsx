import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useIsMobile } from "../editor/blocks/_shared/BlockEditContext";
import s from "./QrScanDialog.module.css";

let scratch: HTMLCanvasElement | null = null;

function decodeToData(source: CanvasImageSource, width: number, height: number): string | null {
  if (!scratch) scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  const img = ctx.getImageData(0, 0, width, height);
  return jsQR(img.data, img.width, img.height)?.data ?? null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (uri: string) => void;
}

export default function QrScanDialog({ open, onClose, onScan }: Props) {
  const mobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const handlersRef = useRef({ onClose, onScan });
  handlersRef.current = { onClose, onScan };
  const [fallback, setFallback] = useState(false);
  const [err, setErr] = useState("");

  const useCamera = mobile && !fallback;

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const handleHit = (data: string) => {
    if (data.toLowerCase().startsWith("otpauth://")) {
      handlersRef.current.onScan(data);
      handlersRef.current.onClose();
    } else {
      setErr("未识别到有效的两步验证二维码");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      const loop = () => {
        if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          const hit = decodeToData(video, video.videoWidth, video.videoHeight);
          if (hit) handleHit(hit);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      setErr("摄像头不可用，已切换为图片识别");
      setFallback(true);
    }
  };

  const pickFile = async (file: File) => {
    try {
      const bmp = await createImageBitmap(file);
      const hit = decodeToData(bmp, bmp.width, bmp.height);
      bmp.close();
      if (!hit) {
        setErr("未识别到二维码");
        return;
      }
      handleHit(hit);
    } catch {
      setErr("图片解析失败");
    }
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setErr("");
      setFallback(false);
      return;
    }
    if (mobile) void startCamera();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopCamera();
        handlersRef.current.onClose();
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) void pickFile(file);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      stopCamera();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mobile]);

  if (!open) return null;

  const close = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className={s.backdrop} onClick={close} contentEditable={false}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()} contentEditable={false}>
        <div className={s.head}>扫描两步验证二维码</div>
        {useCamera ? (
          <div className={s.viewport}>
            <video ref={videoRef} playsInline muted className={s.video} />
          </div>
        ) : (
          <div
            className={s.drop}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void pickFile(f);
            }}
          >
            <div className={s.dropHint}>点击选择二维码图片 · 拖拽图片到此处 · Ctrl+V 粘贴截图</div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void pickFile(f);
              }}
            />
          </div>
        )}
        {err && <div className={s.err}>{err}</div>}
        <div className={s.foot}>
          {useCamera && (
            <button
              type="button"
              className={s.ghostBtn}
              onClick={() => {
                stopCamera();
                setFallback(true);
              }}
            >
              改为图片识别
            </button>
          )}
          <button type="button" className={s.btn} onClick={close}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
