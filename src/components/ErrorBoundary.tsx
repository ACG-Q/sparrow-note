import { Component, type ErrorInfo, type ReactNode } from "react";
import s from "./ErrorBoundary.module.css";

/**
 * 全局兜底：任何一个组件渲染抛错，都不要把整个应用变成白屏。
 *
 * 不做自动重试（出错大概率是数据或状态坏了，自动重试只会循环崩），
 * 给用户两条路：重新加载，或复制错误信息。
 */
type Props = { children: ReactNode };
type State = { error: Error | null; stack: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 本地应用没有上报通道，至少把堆栈留在控制台与状态里，方便用户截图
    this.setState({ stack: info.componentStack ?? "" });
    console.error("[sparrow] 渲染出错：", error, info.componentStack);
  }

  private copy = async () => {
    const { error, stack } = this.state;
    const text = `${error?.message ?? "未知错误"}\n\n${error?.stack ?? ""}\n\n组件栈：\n${stack}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 剪贴板不可用就算了，页面上本来就看得到摘要
    }
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className={s.page}>
        <div className={s.card}>
          <span className={s.kicker}>出错了</span>
          <h1 className={s.title}>这一步没走通</h1>
          <p className={s.lead}>
            界面渲染时抛了个错。你的笔记应该还在本地，重新加载通常就能回来；
            如果反复出现，把下面的信息复制给开发者。
          </p>
          <pre className={s.detail}>{error.message || String(error)}</pre>
          <div className={s.actions}>
            <button type="button" className={s.primary} onClick={() => window.location.reload()}>
              重新加载
            </button>
            <button type="button" className={s.ghost} onClick={this.copy}>
              复制错误信息
            </button>
          </div>
        </div>
      </div>
    );
  }
}
