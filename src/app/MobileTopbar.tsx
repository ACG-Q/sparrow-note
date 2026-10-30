import { ShareMenuItems } from "../components/ShareMenuItems";
import menuCss from "../components/menu.module.css";
import s from "../App.module.css";

/** 手机菜单项样式：共用菜单样式 */
const POP_ITEM = menuCss.item;

/**
 * 窄屏顶栏：返回 / 标题 / 抽屉菜单 / 阅读编辑切换 / ⋯ 菜单（含分享与删除）。
 * 从 App.tsx 搬出来的纯展示层，行为不变。
 */
export function MobileTopbar({
  active,
  title,
  readMode,
  menuOpen,
  onBack,
  onOpenDrawer,
  onToggleRead,
  onToggleMenu,
  onCloseMenu,
  onOpenDatePicker,
  onShareMd,
  onShareMdZip,
  onSharePdf,
  onSharePng,
  onPrint,
  onDelete,
}: {
  active: { id: string } | null;
  title: string;
  readMode: boolean;
  menuOpen: boolean;
  onBack: () => void;
  onOpenDrawer: () => void;
  onToggleRead: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onOpenDatePicker: () => void;
  onShareMd?: () => void;
  onShareMdZip?: () => void;
  onSharePdf?: () => void;
  onSharePng?: (width: number) => void;
  onPrint?: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <header className={s.topbar}>
      <button className={s.btnIcon} onClick={onBack} aria-label="返回">
        ←
      </button>
      <span className={s.topbarTitle}>{title}</span>
      <button className={s.btnIcon} onClick={onOpenDrawer} aria-label="菜单">
        ☰
      </button>
      <div className={s.menuWrap}>
        <button className={s.readToggle} onClick={onToggleRead} aria-pressed={readMode}>
          {readMode ? "编辑" : "阅读"}
        </button>
        <button className={s.btnIcon} onClick={onToggleMenu} aria-label="更多操作">
          ⋯
        </button>
        {menuOpen && (
          <>
            <div className={s.popBackdrop} onClick={onCloseMenu} />
            <div className={`${menuCss.menu} ${s.popMenuPos}`}>
              {!readMode && (
                <button
                  className={POP_ITEM}
                  onClick={() => {
                    onOpenDatePicker();
                    onCloseMenu();
                  }}
                >
                  改日期
                </button>
              )}
              {active && (
                <ShareMenuItems
                  className={POP_ITEM}
                  onMarkdown={onShareMd}
                  onMarkdownZip={onShareMdZip}
                  onPdf={onSharePdf}
                  onPng={onSharePng}
                  onPrint={onPrint}
                  onClose={onCloseMenu}
                />
              )}
              {active && (
                <button
                  className={`${POP_ITEM} ${menuCss.danger}`}
                  onClick={() => {
                    onDelete(active.id);
                    onCloseMenu();
                  }}
                >
                  删除笔记
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
