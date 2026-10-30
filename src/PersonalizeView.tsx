import { setThemePref, useThemePref, type ThemePref } from "./lib/theme";
import {
  allSummaryKinds,
  moveSummaryKind,
  setSetting,
  SUMMARY_KIND_META,
  useSettings,
  type ReaderSize,
  type SummaryKind,
} from "./lib/settings";
import s from "./SettingsView.module.css";

const THEMES: { key: ThemePref; label: string }[] = [
  { key: "light", label: "日间纸" },
  { key: "dark", label: "夜间纸" },
  { key: "auto", label: "跟随系统" },
];

const SIZES: { key: ReaderSize; label: string }[] = [
  { key: "s", label: "小" },
  { key: "m", label: "标准" },
  { key: "l", label: "大" },
];

function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={s.seg} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={value === o.key ? `${s.segBtn} ${s.segOn}` : s.segBtn}
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PersonalizeView({ onBack }: { onBack: () => void }) {
  const themePref = useThemePref();
  const settings = useSettings();
  const enabled = settings.summaryKinds;

  /** 勾选/取消某一类；新勾的排在末尾 */
  const toggleKind = (kind: SummaryKind) => {
    const next = enabled.includes(kind)
      ? enabled.filter((k) => k !== kind)
      : allSummaryKinds().filter((k) => k === kind || enabled.includes(k));
    setSetting("summaryKinds", next);
  };

  return (
    <div className={s.page}>
      <div className={s.phead}>
        <button type="button" className={s.back} onClick={onBack}>
          ← 我的
        </button>
        <div className={s.pheadRow}>
          <h1>个性化</h1>
          <span className={s.pn}>本机</span>
        </div>
      </div>

      <section className={s.block}>
        <h2 className={s.bh}>外观</h2>
        <div className={s.row}>
          <span className={s.rowLabel}>主题</span>
          <Seg
            label="主题"
            options={THEMES}
            value={themePref}
            onChange={(v) => setThemePref(v)}
          />
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>正文字号</span>
          <Seg
            label="正文字号"
            options={SIZES}
            value={settings.readerSize}
            onChange={(v) => setSetting("readerSize", v)}
          />
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>减少动效</span>
          <Seg
            label="减少动效"
            options={[
              { key: "off", label: "关" },
              { key: "on", label: "开" },
            ]}
            value={settings.reduceMotion ? "on" : "off"}
            onChange={(v) => setSetting("reduceMotion", v === "on")}
          />
        </div>
      </section>

      <section className={s.block}>
        <h2 className={s.bh}>阅读与条目</h2>
        <div className={s.row}>
          <span className={s.rowLabel}>打开笔记时</span>
          <Seg
            label="打开笔记时"
            options={[
              { key: "read", label: "阅读" },
              { key: "edit", label: "编辑" },
            ]}
            value={settings.defaultNoteMode}
            onChange={(v) => setSetting("defaultNoteMode", v)}
          />
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>银行卡号默认显示</span>
          <Seg
            label="银行卡号默认显示"
            options={[
              { key: "off", label: "关" },
              { key: "on", label: "开" },
            ]}
            value={settings.showCardNumber ? "on" : "off"}
            onChange={(v) => setSetting("showCardNumber", v === "on")}
          />
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>条目显示心情</span>
          <Seg
            label="条目显示心情"
            options={[
              { key: "on", label: "开" },
              { key: "off", label: "关" },
            ]}
            value={settings.showMoodMeta ? "on" : "off"}
            onChange={(v) => setSetting("showMoodMeta", v === "on")}
          />
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>代码块折叠</span>
          <Seg
            label="代码块折叠"
            options={[
              { key: "8", label: "8 行" },
              { key: "14", label: "14 行" },
              { key: "24", label: "24 行" },
              { key: "0", label: "不折叠" },
            ]}
            value={String(settings.codeCollapseLines)}
            onChange={(v) => setSetting("codeCollapseLines", Number(v))}
          />
        </div>
        <p className={s.hintText}>阅读时超过这个行数的代码块先折起来，点「展开全部」再看完整内容。</p>
      </section>

      <section className={s.block}>
        <h2 className={s.bh}>纪念日提醒</h2>
        <div className={s.row}>
          <span className={s.rowLabel}>到期提醒</span>
          <Seg
            label="到期提醒"
            options={[
              { key: "on", label: "开" },
              { key: "off", label: "关" },
            ]}
            value={settings.reminderEnabled ? "on" : "off"}
            onChange={(v) => setSetting("reminderEnabled", v === "on")}
          />
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>提醒时间</span>
          <Seg
            label="提醒时间"
            options={[
              { key: "8", label: "08:00" },
              { key: "9", label: "09:00" },
              { key: "12", label: "12:00" },
              { key: "20", label: "20:00" },
            ]}
            value={String(settings.reminderHour)}
            onChange={(v) => setSetting("reminderHour", Number(v))}
          />
        </div>
        <div className={s.row}>
          <span className={s.rowLabel}>提前天数</span>
          <Seg
            label="提前天数"
            options={[
              { key: "0", label: "当天" },
              { key: "1", label: "1 天" },
              { key: "3", label: "3 天" },
            ]}
            value={String(settings.reminderWithinDays)}
            onChange={(v) => setSetting("reminderWithinDays", Number(v))}
          />
        </div>
        <p className={s.hintText}>
          在纪念日块里打开「到期提醒」的才会推通知；单块还可以单独设提前几天。
        </p>
      </section>

      <section className={s.block}>
        <h2 className={s.bh}>汇总分类</h2>
        <p className={s.hintText}>
          勾上的分类会出现在「汇总」页的标签栏里，顺序即标签顺序。
        </p>
        <div className={s.kindList}>
          {allSummaryKinds().map((k) => (
            <KindRow
              key={k}
              kind={k}
              enabled={enabled.includes(k)}
              position={enabled.indexOf(k)}
              total={enabled.length}
              onToggle={() => toggleKind(k)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function KindRow({
  kind,
  enabled,
  position,
  total,
  onToggle,
}: {
  kind: SummaryKind;
  enabled: boolean;
  position: number;
  total: number;
  onToggle: () => void;
}) {
  const meta = SUMMARY_KIND_META[kind];
  return (
    <div className={enabled ? `${s.kindRow} ${s.kindOn}` : s.kindRow}>
      <button
        type="button"
        role="checkbox"
        aria-checked={enabled}
        aria-label={meta.label}
        className={enabled ? `${s.kindBox} ${s.kindBoxOn}` : s.kindBox}
        onClick={onToggle}
      >
        {enabled ? "✓" : ""}
      </button>
      <span className={s.kindText}>
        <span className={s.kindLabel}>{meta.label}</span>
        <span className={s.kindHint}>{meta.hint}</span>
      </span>
      {enabled && (
        <span className={s.kindMoves}>
          <button
            type="button"
            className={s.moveBtn}
            aria-label={`${meta.label} 上移`}
            disabled={position <= 0}
            onClick={() => moveSummaryKind(kind, -1)}
          >
            ↑
          </button>
          <button
            type="button"
            className={s.moveBtn}
            aria-label={`${meta.label} 下移`}
            disabled={position >= total - 1}
            onClick={() => moveSummaryKind(kind, 1)}
          >
            ↓
          </button>
        </span>
      )}
    </div>
  );
}