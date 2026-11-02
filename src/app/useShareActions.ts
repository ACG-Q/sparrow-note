import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteDoc } from "../db/notes";
import { noteToMarkdown, noteToMarkdownWithAssets, type ShareBlock } from "../lib/share";
import { saveErrorText, type SaveOutcome } from "../lib/saveFile";
import {
  downloadMarkdownFile,
  downloadMarkdownZip,
  exportNodePng,
  exportNotePdf,
  printNode,
} from "../lib/shareExport";

/**
 * 分享相关的动作集合（Markdown / Markdown+附件 / PDF / 长图 / 打印）。
 *
 * 从 App.tsx 搬出来的：这些都是「拿到阅读态 DOM 或块数据 → 产出文件」的纯动作，
 * 只依赖当前笔记和一个提示回调，不需要知道路由和面板状态。
 *
 * 所有导出都按真实结果提示：移动端「另存为」被取消时说取消，写盘失败时说失败，
 * 不能再像以前那样点一下就报「已导出」。
 */
export type ShareActions = {
  shareMarkdown: () => void;
  shareMarkdownZip: () => void;
  sharePdf: () => void;
  sharePng: (width?: number) => void;
  sharePrint: () => void;
  /** 导出结果的小提示文案（「已保存 3 张图」），2.8 秒后自动消失 */
  shareHint: string | null;
  showShareHint: (text: string) => void;
};

/** 分享的目标节点：优先用阅读态的容器，编辑器里退回到 .bn-editor */
function shareRoot(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('[data-share-root="1"]') ??
    document.querySelector<HTMLElement>(".bn-editor")
  );
}

/** 笔记块 → 分享用的块类型（跨边界的一处断言，集中在这一个函数里） */
function shareBlocksOf(note: NoteDoc | null): ShareBlock[] {
  return (note?.blocks ?? []) as unknown as ShareBlock[];
}

/** 一次保存结果 → 提示文案；取消和已落盘分开说 */
export function saveHintText(outcome: SaveOutcome): string {
  if (outcome.status === "cancelled") return "已取消保存";
  return outcome.via === "tauri" ? `已保存 ${outcome.name}` : `已开始下载 ${outcome.name}`;
}

export function useShareActions(active: NoteDoc | null): ShareActions {
  const [shareHint, setShareHint] = useState<string | null>(null);
  const hintTimer = useRef<number | null>(null);

  const showShareHint = useCallback((text: string) => {
    setShareHint(text);
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setShareHint(null), 2800);
  }, []);

  useEffect(() => () => {
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
  }, []);

  /** 所有「生成 + 保存」串起来的地方都过这一关：结果由真实返回值决定 */
  const runExport = useCallback(
    (run: () => Promise<SaveOutcome>, label: string) => {
      void run()
        .then((outcome) => showShareHint(saveHintText(outcome)))
        .catch((e: unknown) => showShareHint(`${label} 失败：${saveErrorText(e)}`));
    },
    [showShareHint],
  );

  const shareMarkdown = useCallback(() => {
    if (!active) return;
    const md = noteToMarkdown(shareBlocksOf(active), { title: active.title, date: active.date });
    runExport(() => downloadMarkdownFile(md, active.title), "导出 Markdown");
  }, [active, runExport]);

  const shareMarkdownZip = useCallback(() => {
    if (!active) return;
    const bundle = noteToMarkdownWithAssets(shareBlocksOf(active), {
      title: active.title,
      date: active.date,
    });
    runExport(() => downloadMarkdownZip(bundle, active.title), "导出 Markdown + 附件");
  }, [active, runExport]);

  const sharePdf = useCallback(() => {
    if (!active) return;
    // 矢量文字：中文可选中、可搜索，手机上也能直接出文件
    runExport(
      () => exportNotePdf(shareBlocksOf(active), { title: active.title, date: active.date }),
      "导出 PDF",
    );
  }, [active, runExport]);

  const sharePng = useCallback(
    (width?: number) => {
      const root = shareRoot();
      if (!root || !active) return;
      void exportNodePng(root, active.title, { width })
        .then((res) => {
          // 移动端每张图都要过一次「另存为」：按真实保存的张数说话
          const saves = res.saves ?? [];
          const saved = saves.filter((o) => o.status === "saved");
          const cancelled = saves.some((o) => o.status === "cancelled");
          if (saved.length === 0) {
            showShareHint("已取消保存");
            return;
          }
          const first = saved[0];
          const verb = first.status === "saved" && first.via === "tauri" ? "已保存" : "已开始下载";
          showShareHint(`${verb} ${saved.length} 张图${cancelled ? "，其余已取消" : ""}`);
        })
        .catch((e: unknown) => showShareHint(`长图导出失败：${saveErrorText(e)}`));
    },
    [active, showShareHint],
  );

  const sharePrint = useCallback(() => {
    const root = shareRoot();
    if (!root) return;
    printNode(root);
  }, []);

  return { shareMarkdown, shareMarkdownZip, sharePdf, sharePng, sharePrint, shareHint, showShareHint };
}
