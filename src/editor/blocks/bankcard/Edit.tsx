import { useState } from "react";
import s from "./styles.module.css";
import { GhostLink, PanelSection, PanelInput, SegCtl } from "../_shared/panelKit";
import {
  THEME_CLASS,
  groupNo,
  maskNo,
  type BankTheme,
  type BankcardBlockT,
  type BankcardEditor,
} from "./config";

const KIND_OPTIONS = [
  { value: "储蓄卡", label: "储蓄卡" },
  { value: "信用卡", label: "信用卡" },
  { value: "其他", label: "其他" },
];

const THEMES: BankTheme[] = ["blue", "purple", "teal", "rose"];

export default function BankcardEdit({
  block,
  editor,
}: {
  block: BankcardBlockT;
  editor: BankcardEditor;
}) {
  const p = block.props;
  const theme = p.theme as BankTheme;
  const [reveal, setReveal] = useState(false);
  const digits = p.no.replace(/\D/g, "");
  const len = digits.length;
  const invalid = len > 0 && len < 16;

  return (
    <>
      <PanelSection label="预览">
        <div className={`${s.mini} ${THEME_CLASS[theme]}`}>
          <div className={s.mcTop}>
            <span className={s.mcBank}>{p.bank || "银行名称"}</span>
            <span className={s.mcKind}>{p.kind}</span>
          </div>
          <div className={s.mcNo}>
            {digits ? (reveal ? groupNo(digits) : maskNo(digits)) : "•••• •••• •••• ••••"}
          </div>
          <div className={s.mcHolder}>{p.holder || "持卡人"}</div>
        </div>
        {digits ? (
          <GhostLink onClick={() => setReveal((v) => !v)}>
            {reveal ? "隐藏完整卡号" : "查看完整卡号"}
          </GhostLink>
        ) : null}
      </PanelSection>

      <PanelSection label="银行">
        <PanelInput
          placeholder="银行名称"
          value={p.bank}
          onChange={(e) => editor.updateBlock(block, { props: { bank: e.target.value } })}
        />
      </PanelSection>

      <PanelSection label="卡种">
        <SegCtl
          options={KIND_OPTIONS}
          value={p.kind}
          onChange={(v) => editor.updateBlock(block, { props: { kind: v as typeof p.kind } })}
        />
      </PanelSection>

      <PanelSection label="卡号" hint="16–19 位数字">
        <PanelInput
          placeholder="6222 0000 0000 0000"
          value={groupNo(p.no)}
          inputMode="numeric"
          maxLength={23}
          style={{ fontFamily: "var(--mono)", letterSpacing: "1px" }}
          onChange={(e) =>
            editor.updateBlock(block, {
              props: { no: e.target.value.replace(/\D/g, "").slice(0, 19) },
            })
          }
        />
        <div className={invalid ? s.hint : `${s.hint} ${s.hintOk}`}>
          {len === 0
            ? "只保存在本机，不会上传。"
            : invalid
              ? `卡号应为 16–19 位，当前 ${len} 位。`
              : `${len} 位 · 只保存在本机。`}
        </div>
      </PanelSection>

      <PanelSection label="持卡人">
        <PanelInput
          placeholder="持卡人姓名"
          value={p.holder}
          onChange={(e) => editor.updateBlock(block, { props: { holder: e.target.value } })}
        />
      </PanelSection>

      <PanelSection label="卡面配色">
        <div className={s.swatches}>
          {THEMES.map((t) => (
            <button
              key={t}
              type="button"
              className={
                t === theme
                  ? `${s.swatch} ${s[`swatch_${t}`]} ${s.swatchOn}`
                  : `${s.swatch} ${s[`swatch_${t}`]}`
              }
              aria-label={`配色 ${t}`}
              contentEditable={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.updateBlock(block, { props: { theme: t } })}
            />
          ))}
        </div>
      </PanelSection>
    </>
  );
}
