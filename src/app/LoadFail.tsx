import s from "../App.module.css";

/** 读库失败页：给出原因，并允许重试 */
export function LoadFail({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className={s.loadFail}>
      <div className={s.loadFailCard}>
        <span className={s.loadFailKicker}>打不开笔记库</span>
        <h1 className={s.loadFailTitle}>读不出你的笔记</h1>
        <p className={s.loadFailLead}>
          数据应该都还在本地，多半是文件被占用或数据库损坏。可以重试；如果一直失败，
          先去「设置 → 存储」导出备份，再排查。
        </p>
        <pre className={s.loadFailDetail}>{error}</pre>
        <div className={s.loadFailActions}>
          <button type="button" className={s.loadFailPrimary} onClick={onRetry}>
            重试
          </button>
          <button
            type="button"
            className={s.loadFailGhost}
            onClick={() => window.location.reload()}
          >
            重新加载
          </button>
        </div>
      </div>
    </div>
  );
}
