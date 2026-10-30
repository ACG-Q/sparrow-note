import { useState, type ReactNode } from "react";
import { ShareMenuItems } from "./ShareMenuItems";
import menu from "./menu.module.css";
import s from "./Viewbar.module.css";

function IconNav() {
  return (
    <svg viewBox="0 0 16 16" className={s.icon} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.5" y="3" width="11" height="10" />
      <line x1="6.5" y1="3" x2="6.5" y2="13" />
    </svg>
  );
}

function IconList() {
  return (
    <svg viewBox="0 0 16 16" className={s.icon} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <line x1="3" y1="4.5" x2="13" y2="4.5" />
      <line x1="3" y1="8" x2="13" y2="8" />
      <line x1="3" y1="11.5" x2="9" y2="11.5" />
    </svg>
  );
}

function IconLock({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={s.icon} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="4" y="7" width="8" height="6.5" />
      {open ? (
        <path d="M6 7V5.4a2 2 0 0 1 3.6-1.2" />
      ) : (
        <path d="M6 7V5.4a2 2 0 0 1 4 0V7" />
      )}
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 16 16" className={s.icon} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M12.4 9.6A4.8 4.8 0 0 1 6.4 3.6 5 5 0 1 0 12.4 9.6Z" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg viewBox="0 0 16 16" className={s.icon} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3.5 12.5 4 10l6.5-6.5 2 2L6 12Z" />
      <line x1="9" y1="4.5" x2="11.5" y2="7" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 16 16" className={s.icon} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2.5 4.5h4A1.5 1.5 0 0 1 8 6v6a1.5 1.5 0 0 0-1.5-1.5h-4Z" />
      <path d="M13.5 4.5H9.5A1.5 1.5 0 0 0 8 6v6a1.5 1.5 0 0 1 1.5-1.5h4Z" />
    </svg>
  );
}

function Toggle({
  pressed,
  onClick,
  icon,
  label,
  title,
}: {
  pressed: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={s.btn}
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
    >
      {icon}
      <span className={s.label}>{label}</span>
    </button>
  );
}

/** 桌面栏位的开关：导航栏 / 目录栏 / 阅读态 / 锁定 */
export type DeskToggles = {
  navOn: boolean;
  listOn: boolean;
  readMode: boolean;
  locked: boolean;
  /** 只有时间线才显示「目录」开关 */
  showList: boolean;
  onToggleNav: () => void;
  onToggleList: () => void;
  onToggleRead: () => void;
  onToggleLock: () => void;
};

/** 分享菜单的动作；没有选中笔记时全为空 */
export type ShareHandlers = {
  onShareMd?: () => void;
  onShareMdZip?: () => void;
  onSharePdf?: () => void;
  onSharePng?: (width: number) => void;
  onPrint?: () => void;
};

export function Viewbar({
  desk,
  dark,
  onToggleTheme,
  canDelete,
  onDelete,
  share,
}: {
  desk: DeskToggles;
  dark: boolean;
  onToggleTheme: () => void;
  canDelete: boolean;
  onDelete: () => void;
  share: ShareHandlers;
}) {
  const { navOn, listOn, readMode, locked, showList, onToggleNav, onToggleList, onToggleRead, onToggleLock } =
    desk;
  const { onShareMd, onShareMdZip, onSharePdf, onSharePng, onPrint } = share;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={s.bar}>
      <Toggle
        pressed={navOn}
        onClick={onToggleNav}
        icon={<IconNav />}
        label="导航"
        title={navOn ? "隐藏导航栏" : "显示导航栏"}
      />
      {showList && (
        <Toggle
          pressed={listOn}
          onClick={onToggleList}
          icon={<IconList />}
          label="目录"
          title={listOn ? "隐藏目录" : "显示目录"}
        />
      )}
      <Toggle
        pressed={locked}
        onClick={onToggleLock}
        icon={<IconLock open={!locked} />}
        label="锁定"
        title={locked ? "已锁定：窄窗不自动收起" : "未锁定：窄窗自动收起"}
      />
      <span className={s.sep} aria-hidden="true">
        /
      </span>
      <Toggle
        pressed={dark}
        onClick={onToggleTheme}
        icon={<IconMoon />}
        label="夜间纸"
        title={dark ? "切换到日间纸" : "切换到夜间纸"}
      />
      <span className={s.spacer} />
      {canDelete && (
        <button className={s.btn} onClick={onToggleRead}>
          {readMode ? <IconPencil /> : <IconBook />}
          <span className={s.label}>{readMode ? "编辑" : "阅读"}</span>
        </button>
      )}
      {canDelete && (
        <div className={s.moreWrap}>
          <button
            className={s.btn}
            aria-label="更多操作"
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((v) => !v);
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div
                className={s.backdrop}
                onClick={() => setMenuOpen(false)}
              />
              <div className={`${menu.menu} ${s.menuPos}`}>
                <ShareMenuItems
                  className={menu.item}
                  onMarkdown={onShareMd}
                  onMarkdownZip={onShareMdZip}
                  onPdf={onSharePdf}
                  onPng={onSharePng}
                  onPrint={onPrint}
                  onClose={() => {
                    setMenuOpen(false);
                  }}
                />
                <div className={menu.group}>
                  <button
                    className={`${menu.item} ${menu.danger}`}
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    删除这篇
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
