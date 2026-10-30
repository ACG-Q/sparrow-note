import { useState } from "react";
import { useTotp } from "../lib/useTotp";
import s from "./AccountCard.module.css";

function str(props: Record<string, unknown>, key: string): string {
  const v = props[key];
  return typeof v === "string" ? v.trim() : "";
}

/** 阅读态的账号卡片：查看 / 复制账号密码、随时取 2FA 验证码 */
export function AccountCard({ props }: { props: Record<string, unknown> }) {
  const site = str(props, "site");
  const url = str(props, "url");
  const user = str(props, "user");
  const pass = str(props, "pass");
  const note = str(props, "note");
  const totp = str(props, "totp");

  const totpState = useTotp(totp);
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState("");

  if (!site && !user && !pass) return null;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("");
    }
  };

  return (
    <section className={s.card} aria-label={site || "账号"}>
      <header className={s.head}>
        <span className={s.site}>{site || "未命名账号"}</span>
        {url && (
          <a
            className={s.open}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
          >
            打开 →
          </a>
        )}
      </header>

      <div className={s.row}>
        <span className={s.label}>账号</span>
        <span className={s.value}>{user || "—"}</span>
        {user && (
          <button type="button" className={s.act} onClick={() => void copy("user", user)}>
            {copied === "user" ? "已复制" : "复制"}
          </button>
        )}
      </div>

      <div className={s.row}>
        <span className={s.label}>密码</span>
        <span className={show ? `${s.value} ${s.pass}` : `${s.value} ${s.dots}`}>
          {pass ? (show ? pass : "••••••••••••") : "—"}
        </span>
        {pass && (
          <>
            <button type="button" className={s.act} onClick={() => setShow((v) => !v)}>
              {show ? "隐藏" : "查看"}
            </button>
            <button type="button" className={s.act} onClick={() => void copy("pass", pass)}>
              {copied === "pass" ? "已复制" : "复制"}
            </button>
          </>
        )}
      </div>

      {totpState && (
        <div className={`${s.row} ${s.totpRow}`}>
          <span className={s.label}>2FA</span>
          <button
            type="button"
            className={s.totpCode}
            onClick={() => void copy("totp", totpState.code)}
            title="点击复制验证码"
          >
            {totpState.code.replace(/(.{3})/g, "$1 ").trim()}
          </button>
          <span className={s.totpBar} aria-hidden="true">
            <i style={{ width: `${(totpState.remain / totpState.period) * 100}%` }} />
          </span>
          <span className={s.totpLeft}>{totpState.remain}s</span>
        </div>
      )}

      {note && <p className={s.note}>{note}</p>}
    </section>
  );
}
