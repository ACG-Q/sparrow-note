import { useState, type ReactNode } from "react";
import s from "./panel.module.css";
import { stopMouseDown } from "./BlockShell";

export function PanelSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={s.section}>
      <div className={s.label}>
        {label}
        {hint && <span className={s.labelHint}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function PanelInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={props.className ? `${s.input} ${props.className}` : s.input}
      onMouseDown={stopMouseDown}
    />
  );
}

export function PanelTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={props.className ? `${s.input} ${s.textarea} ${props.className}` : `${s.input} ${s.textarea}`}
      onMouseDown={stopMouseDown}
    />
  );
}

export function SegCtl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={s.segCtl} contentEditable={false}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === value ? s.segOn : s.segBtn}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SwitchRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className={s.switchRow}>
      <div className={s.switchText}>
        <div className={s.switchTitle}>{title}</div>
        {desc && <div className={s.switchDesc}>{desc}</div>}
      </div>
      <button
        type="button"
        className={checked ? `${s.switch} ${s.switchOn}` : s.switch}
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className={s.rows}>{children}</div>;
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      {children}
    </div>
  );
}

export function RowInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={props.className ? `${s.rowInput} ${props.className}` : s.rowInput}
      onMouseDown={stopMouseDown}
    />
  );
}

export function MiniBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      className={s.miniBtn}
      contentEditable={false}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function GhostLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={s.ghostLink}
      contentEditable={false}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Avatar({ text, size }: { text: string; size?: "sm" }) {
  return <span className={size === "sm" ? `${s.avatar} ${s.avatarSm}` : s.avatar}>{text}</span>;
}

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => {});
  };
  return [copied, copy];
}
