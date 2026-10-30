import { createPortal } from "react-dom";
import s from "./FeatureHint.module.css";

/**
 * 右下角浮动说明卡。
 *
 * 用途：悬停一个「看不出后果」的操作时，在角落里解释这一步会改什么、要注意什么。
 * 做成受控组件（内容为 null 就不渲染），任何地方都能复用：
 *
 *   const [hint, setHint] = useState<FeatureHintData | null>(null);
 *   <FeatureHint data={hint} />
 */
export type FeatureHintData = {
  /** 操作名，例如「本行上移」 */
  title: string;
  /** 一句话说明这一步做什么 */
  desc?: string;
  /** 注意点，逐条列出 */
  notes?: string[];
  /** 顶部小标签，默认「操作说明」 */
  kicker?: string;
  /** 一个字符级的示意图，例如 "↑" / "⤒ 行" */
  glyph?: string;
};

export function FeatureHint({ data }: { data: FeatureHintData | null }) {
  if (!data || typeof document === "undefined") return null;
  return createPortal(
    <aside className={s.hint} role="status" aria-live="polite">
      <span className={s.kicker}>{data.kicker ?? "操作说明"}</span>
      <div className={s.head}>
        {data.glyph && (
          <span className={s.glyph} aria-hidden="true">
            {data.glyph}
          </span>
        )}
        <span className={s.title}>{data.title}</span>
      </div>
      {data.desc && <p className={s.desc}>{data.desc}</p>}
      {data.notes && data.notes.length > 0 && (
        <ul className={s.notes}>
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </aside>,
    document.body,
  );
}
