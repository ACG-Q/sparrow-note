import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./styles/global.css";
import "./styles/editor-polish.css";
import "./styles/editorial.css";
import { initSettings } from "./lib/settings";
import { startAutoUpdateCheck } from "./lib/updateNotice";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App";

initSettings();

/**
 * 极端兜底：如果连 React 都没挂上（例如启动阶段就抛错），
 * 至少给一个能看懂、能重试的静态页面，而不是白屏。
 */
function renderStaticFallback(err: unknown) {
  const root = document.getElementById("root");
  if (!root) return;
  const text = err instanceof Error ? err.message : String(err ?? "未知错误");
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 20px;background:#f5f1e8;color:#191713;font-family:-apple-system,'Segoe UI','PingFang SC',sans-serif">
      <div style="max-width:520px;width:100%;padding:26px 28px 24px;border:1px solid #d9d1c0;border-top:2px solid #8a3324">
        <div style="font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.16em;color:#8a3324">启动失败</div>
        <h1 style="margin:8px 0 0;font-family:Georgia,'Songti SC',serif;font-size:24px;letter-spacing:.1em">应用没能启动</h1>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.9;color:#6a6457">数据还在本地。先重新加载试试；反复失败就把下面这行发给开发者。</p>
        <pre style="margin:14px 0 0;padding:10px 12px;border:1px solid #e4ddcf;background:#efe9dc;font-family:ui-monospace,monospace;font-size:11px;white-space:pre-wrap;word-break:break-word">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c)}</pre>
        <div style="margin-top:18px">
          <button onclick="location.reload()" style="padding:8px 14px;border:1px solid #191713;background:#191713;color:#f5f1e8;font-family:ui-monospace,monospace;font-size:11px;cursor:pointer">重新加载</button>
        </div>
      </div>
    </div>`;
}

async function boot() {
  // 开发种子失败不应该拖垮应用启动
  if (import.meta.env.DEV) {
    try {
      const { seedIfRequested } = await import("./dev/seed");
      await seedIfRequested();
    } catch (err) {
      console.warn("[sparrow] 种子数据写入失败，跳过：", err);
    }
  }

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    renderStaticFallback(new Error("找不到 #root 挂载点"));
    return;
  }

  try {
    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (err) {
    console.error("[sparrow] 应用挂载失败：", err);
    renderStaticFallback(err);
    return;
  }

  // 首屏先画；自动检查延迟 1.5s，且只在启动阶段跑这一次
  startAutoUpdateCheck();
}

void boot().catch((err: unknown) => {
  console.error("[sparrow] 启动异常：", err);
  renderStaticFallback(err);
});
