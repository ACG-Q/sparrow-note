import type { ReactNode } from "react";
import s from "./ProfileShell.module.css";

/**
 * 「我的」这一族页面的统一外壳：页面留白 + 页头（返回 / 标题 / 右侧标记 + 压粗底线）。
 *
 * 四个子页面（个性化、权限、设置、关于）原本各自抄了一份相同的页头标记，
 * 样式则全部挤在 `SettingsView.module.css` 里。这里收成一处：
 * 改一次，四页一起变，也不会再出现「关于页的头和设置页的头差 2px」这种事。
 */
export function ProfilePage({
  title,
  marker,
  onBack,
  children,
}: {
  title: string;
  /** 标题右侧的小字：平台、版本这类「当前在哪儿」的信息 */
  marker?: ReactNode;
  /** 有返回时才会出现「← 我的」；「我的」页自己不传 */
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={s.page}>
      <header className={s.head}>
        {onBack && (
          <button type="button" className={s.back} onClick={onBack} aria-label="返回我的">
            ← 我的
          </button>
        )}
        <div className={s.titleRow}>
          <h1 className={s.title}>{title}</h1>
          {marker !== undefined && marker !== null && <span className={s.marker}>{marker}</span>}
        </div>
      </header>
      {children}
    </div>
  );
}
