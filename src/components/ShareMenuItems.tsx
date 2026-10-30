import { useState } from "react";

/**
 * 分享菜单项：桌面（Viewbar）和窄屏（App 的 popMenu）共用一份，
 * 免得两套界面各写一遍、加功能时漏掉一个。
 * className 由调用方给，样式各自沿用自己那套。
 */
export function ShareMenuItems({
  className,
  dangerClassName,
  onMarkdown,
  onMarkdownZip,
  onPdf,
  onPng,
  onPrint,
  onClose,
}: {
  className: string;
  dangerClassName?: string;
  onMarkdown?: () => void;
  onMarkdownZip?: () => void;
  onPdf?: () => void;
  onPng?: (width: number) => void;
  onPrint?: () => void;
  onClose: () => void;
}) {
  const [pngPick, setPngPick] = useState(false);
  const run = (fn: () => void) => {
    onClose();
    fn();
  };
  void dangerClassName;

  return (
    <>
      {onMarkdown && (
        <button className={className} type="button" onClick={() => run(onMarkdown)}>
          导出 Markdown（单文件）
        </button>
      )}
      {onMarkdownZip && (
        <button className={className} type="button" onClick={() => run(onMarkdownZip)}>
          导出 Markdown + 附件（zip）
        </button>
      )}
      {onPdf && (
        <button className={className} type="button" onClick={() => run(onPdf)}>
          导出 PDF
        </button>
      )}
      {onPng && !pngPick && (
        <button className={className} type="button" onClick={() => setPngPick(true)}>
          导出长图 ›
        </button>
      )}
      {onPng && pngPick && (
        <>
          {[
            { w: 480, label: "长图 · 窄 480" },
            { w: 720, label: "长图 · 标准 720" },
            { w: 960, label: "长图 · 宽 960" },
          ].map((opt) => (
            <button
              key={opt.w}
              className={className}
              type="button"
              onClick={() => {
                onClose();
                onPng(opt.w);
              }}
            >
              {opt.label}
            </button>
          ))}
        </>
      )}
      {onPrint && (
        <button className={className} type="button" onClick={() => run(onPrint)}>
          打印 / 另存为 PDF
        </button>
      )}
    </>
  );
}
