import s from "./styles.module.css";
import { PanelSection, PanelInput, SegCtl, SwitchRow } from "../_shared/panelKit";
import { dayStats, type AnniversaryBlockT, type AnniversaryEditor, type DayKind } from "./config";

const KIND_OPTIONS = [
  { value: "count", label: "正计时" },
  { value: "down", label: "倒计时" },
  { value: "anniversary", label: "纪念日" },
];

const DATE_LABEL: Record<DayKind, string> = {
  count: "开始日期",
  down: "目标日期",
  anniversary: "纪念日期",
};

export default function AnniversaryEdit({
  block,
  editor,
}: {
  block: AnniversaryBlockT;
  editor: AnniversaryEditor;
}) {
  const kind = block.props.kind as DayKind;
  const stats = dayStats(kind, block.props.date, block.props.annual);
  return (
    <>
      <PanelSection label="类型">
        <SegCtl
          options={KIND_OPTIONS}
          value={kind}
          onChange={(v) => editor.updateBlock(block, { props: { kind: v as DayKind } })}
        />
      </PanelSection>
      <PanelSection label="名称">
        <PanelInput
          placeholder="给这一天起个名字"
          value={block.props.title}
          onChange={(e) => editor.updateBlock(block, { props: { title: e.target.value } })}
        />
      </PanelSection>
      <PanelSection label={DATE_LABEL[kind]}>
        <PanelInput
          type="date"
          value={block.props.date}
          onChange={(e) => editor.updateBlock(block, { props: { date: e.target.value } })}
        />
      </PanelSection>
      {kind === "anniversary" && (
        <SwitchRow
          title="每年提醒"
          desc="日期按年重复，自动计算下一次"
          checked={block.props.annual}
          onChange={(v) => editor.updateBlock(block, { props: { annual: v } })}
        />
      )}
      {kind !== "count" && (
        <>
          <SwitchRow
            title="到期提醒"
            desc="到设定时间时发一条系统通知（设置里可改时间）"
            checked={block.props.remind === "on"}
            onChange={(v) => editor.updateBlock(block, { props: { remind: v ? "on" : "off" } })}
          />
          {block.props.remind === "on" && (
            <PanelSection label="提前">
              <SegCtl
                options={[
                  { value: "0", label: "当天" },
                  { value: "1", label: "1 天" },
                  { value: "3", label: "3 天" },
                  { value: "7", label: "7 天" },
                ]}
                value={block.props.remindDays}
                onChange={(v) => editor.updateBlock(block, { props: { remindDays: v } })}
              />
            </PanelSection>
          )}
        </>
      )}
      <PanelSection label="预览">
        <div className={s.preview}>
          <span className={s.previewName}>{block.props.title || "未命名"}</span>
          {stats && <span className={s.num}>{stats.num}</span>}
        </div>
      </PanelSection>
    </>
  );
}
