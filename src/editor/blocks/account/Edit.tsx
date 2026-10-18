import { useState } from "react";
import s from "./styles.module.css";
import {
  PanelSection,
  PanelTextarea,
  Rows,
  Row,
  RowInput,
  MiniBtn,
  GhostLink,
  useCopy,
} from "../_shared/panelKit";
import { genPassword, passStrength, type AccountBlockT, type AccountEditor } from "./config";
import { normalizeTotpInput } from "../../../lib/totp";
import { useTotp } from "../../../lib/useTotp";
import QrScanDialog from "../../../components/QrScanDialog";

export default function AccountEdit({
  block,
  editor,
}: {
  block: AccountBlockT;
  editor: AccountEditor;
}) {
  const p = block.props;
  const [showPass, setShowPass] = useState(false);
  const [copiedUser, copyUser] = useCopy();
  const [copiedPass, copyPass] = useCopy();
  const [totpInput, setTotpInput] = useState("");
  const [totpErr, setTotpErr] = useState("");
  const totpState = useTotp(p.totp);
  const [copiedTotp, copyTotp] = useCopy();
  const [scanOpen, setScanOpen] = useState(false);

  const addTotp = () => {
    const norm = normalizeTotpInput(totpInput);
    if (!norm) {
      setTotpErr("密钥格式不正确");
      return;
    }
    setTotpErr("");
    setTotpInput("");
    editor.updateBlock(block, { props: { totp: norm } });
  };
  const set = (key: "site" | "url" | "user" | "pass" | "note") => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    editor.updateBlock(block, { props: { [key]: e.target.value } });
  };
  const strength = passStrength(p.pass);
  return (
    <>
      <PanelSection label="站点">
        <Rows>
          <Row label="名称">
            <RowInput placeholder="网站 / 应用" value={p.site} onChange={set("site")} />
          </Row>
          <Row label="网址">
            <RowInput placeholder="https://…" value={p.url} onChange={set("url")} />
          </Row>
        </Rows>
      </PanelSection>
      <PanelSection label="凭据">
        <Rows>
          <Row label="账号">
            <RowInput
              placeholder="账号 / 邮箱"
              value={p.user}
              onChange={set("user")}
              style={{ fontFamily: "Consolas, ui-monospace, monospace" }}
            />
            <MiniBtn onClick={() => p.user && copyUser(p.user)}>
              {copiedUser ? "已复制" : "复制"}
            </MiniBtn>
          </Row>
          <Row label="密码">
            <RowInput
              type={showPass ? "text" : "password"}
              placeholder="密码"
              value={p.pass}
              onChange={set("pass")}
              style={{ fontFamily: "Consolas, ui-monospace, monospace" }}
            />
            <MiniBtn onClick={() => setShowPass((v) => !v)}>{showPass ? "隐藏" : "显示"}</MiniBtn>
            <MiniBtn onClick={() => p.pass && copyPass(p.pass)}>
              {copiedPass ? "已复制" : "复制"}
            </MiniBtn>
          </Row>
        </Rows>
        {p.pass && (
          <div className={s.strength}>
            <div className={s.strengthBar}>
              {[1, 2, 3, 4].map((i) => (
                <i
                  key={i}
                  className={
                    i <= strength.level + 1
                      ? `${s.seg} ${s[`segF${Math.min(strength.level + 1, 3)}`]}`
                      : s.seg
                  }
                />
              ))}
            </div>
            <span className={s.strengthText}>
              {strength.label}
              {strength.level === 3 ? " · 建议保留" : ""}
            </span>
          </div>
        )}
        <GhostLink onClick={() => editor.updateBlock(block, { props: { pass: genPassword() } })}>
          生成随机密码
        </GhostLink>
      </PanelSection>
      <PanelSection label="两步验证" hint={p.totp ? "" : "可选"}>
        {p.totp && totpState ? (
          <Rows>
            <Row label="动态码">
              <span
                style={{
                  fontFamily: "Consolas, ui-monospace, monospace",
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: 1,
                  color: "var(--accent)",
                }}
              >
                {totpState.code.replace(/(.{3})/g, "$1 ").trim()}
              </span>
              <MiniBtn onClick={() => copyTotp(totpState.code)}>
                {copiedTotp ? "已复制" : "复制"}
              </MiniBtn>
              <MiniBtn
                onClick={() => {
                  editor.updateBlock(block, { props: { totp: "" } });
                }}
              >
                移除
              </MiniBtn>
            </Row>
          </Rows>
        ) : (
          <Rows>
            <Row label="密钥">
              <RowInput
                placeholder="粘贴 base32 密钥或 otpauth:// 链接"
                value={totpInput}
                onChange={(e) => {
                  setTotpInput(e.target.value);
                  if (totpErr) setTotpErr("");
                }}
              />
              <MiniBtn onClick={addTotp}>添加</MiniBtn>
            </Row>
          </Rows>
        )}
        {totpErr && <div className={s.err}>{totpErr}</div>}
        {!(p.totp && totpState) && (
          <GhostLink onClick={() => setScanOpen(true)}>扫码添加</GhostLink>
        )}
      </PanelSection>
      <PanelSection label="备注" hint="可选">
        <PanelTextarea
          placeholder="两步验证已开启、备用码位置……"
          value={p.note}
          onChange={set("note")}
        />
      </PanelSection>
      <QrScanDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(uri) => {
          const norm = normalizeTotpInput(uri);
          if (norm) {
            editor.updateBlock(block, { props: { totp: norm } });
            setScanOpen(false);
          }
        }}
      />
    </>
  );
}
