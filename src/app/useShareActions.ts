import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteDoc } from "../db/notes";
import { noteToMarkdown, noteToMarkdownWithAssets, type ShareBlock } from "../lib/share";
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
 */
export type ShareActions = {
  shareMarkdown: () => void;
  shareMarkdownZip: () => void;
  sharePdf: () => void;
  sharePng: (width?: number) => void;
  sharePrint: () => void;
  /** 导出结果的小提示文案（「已导出 3 张图」），2.8 秒后自动消失 */
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



  const shareMarkdown = useCallback(() => {
    if (!active) return;
    const md = noteToMarkdown(shareBlocksOf(active), { title: active.title, date: active.date });
    downloadMarkdownFile(md, active.title);
  }, [active]);

  const shareMarkdownZip = useCallback(() => {
    if (!active) return;
    const bundle = noteToMarkdownWithAssets(shareBlocksOf(active), {
      title: active.title,
      date: active.date,
    });
    downloadMarkdownZip(bundle, active.title);
  }, [active]);

  const sharePdf = useCallback(() => {
    if (!active) return;
    // 矢量文字：中文可选中、可搜索，手机上也能直接出文件
    void exportNotePdf(shareBlocksOf(active), { title: active.title, date: active.date }).catch(
      () => {
        /* 生成失败时静默：用户还能用长图 */
      },
    );
  }, [active]);

  const sharePng = useCallback(
    (width?: number) => {
      const root = shareRoot();
      if (!root || !active) return;
      void exportNodePng(root, active.title, { width })
        .then((res) => showShareHint(`已导出 ${res.count} 张图`))
        .catch(() => showShareHint("长图导出失败"));
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
