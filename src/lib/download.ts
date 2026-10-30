/** 文件名收口：去掉非法字符，并保证带图片扩展名（标题里没写 .png 时补上） */
export function imageFileName(name: string): string {
  const safe = name.replace(/[\\/:*?"<>|]/g, "_") || "image";
  return /\.(png|jpe?g|webp)$/i.test(safe) ? safe : `${safe}.png`;
}

/**
 * 拆图时的带序号文件名，index 从 0 起：
 * 第 1 张沿用原标题「标题.png」，之后「标题-2.png」「标题-3.png」…
 * 标题本身已带图片扩展名时先剥掉，免得拼出「标题.png-2.png」这种名字。
 */
export function partFileName(name: string, index: number): string {
  const safe = name.replace(/[\\/:*?"<>|]/g, "_").trim() || "麻雀记";
  const stem = safe.replace(/\.(png|jpe?g|webp)$/i, "") || "麻雀记";
  return imageFileName(index <= 0 ? stem : `${stem}-${index + 1}`);
}

/** 把 data URL 存成文件；SVG 会先画进 canvas 再导出 PNG */
export async function saveImageAs(dataUrl: string, name: string): Promise<void> {
  const fileName = imageFileName(name);

  if (!dataUrl.startsWith("data:image/svg")) {
    triggerDownload(dataUrl, fileName);
    return;
  }

  const png = await svgToPng(dataUrl);
  triggerDownload(png, fileName);
}

function triggerDownload(url: string, name: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function svgToPng(svgDataUrl: string, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 1200;
      const h = img.naturalHeight || 800;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas unavailable"));
        return;
      }
      // 透明底的 SVG 补一层纸色，免得存出来是黑底
      ctx.fillStyle = "#f5f1e8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("svg load failed"));
    img.src = svgDataUrl;
  });
}
