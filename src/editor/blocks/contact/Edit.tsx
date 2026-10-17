import { useState } from "react";
import {
  PanelSection,
  PanelInput,
  PanelTextarea,
  Rows,
  Row,
  RowInput,
  GhostLink,
} from "../_shared/panelKit";
import type { ContactBlockT, ContactEditor } from "./config";

export default function ContactEdit({
  block,
  editor,
}: {
  block: ContactBlockT;
  editor: ContactEditor;
}) {
  const p = block.props;
  const set =
    (key: "name" | "phone" | "email" | "company" | "title" | "relation" | "birthday" | "note") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      editor.updateBlock(block, { props: { [key]: e.target.value } });
    };
  const hasExtra = !!(p.email || p.company || p.title || p.relation || p.birthday || p.note);
  const [showExtra, setShowExtra] = useState(hasExtra);
  return (
    <>
      <PanelSection label="姓名">
        <PanelInput
          style={{ fontSize: "17px", fontWeight: 600, padding: "10px 12px" }}
          placeholder="姓名"
          value={p.name}
          onChange={set("name")}
        />
      </PanelSection>
      <PanelSection label="电话">
        <Rows>
          <Row label="手机">
            <RowInput placeholder="电话号码" value={p.phone} onChange={set("phone")} />
          </Row>
        </Rows>
      </PanelSection>
      <PanelSection label="邮箱">
        <Rows>
          <Row label="个人">
            <RowInput type="email" placeholder="name@example.com" value={p.email} onChange={set("email")} />
          </Row>
        </Rows>
      </PanelSection>
      <PanelSection label="工作">
        <Rows>
          <Row label="公司">
            <RowInput placeholder="公司名称" value={p.company} onChange={set("company")} />
          </Row>
          <Row label="职位">
            <RowInput placeholder="职位" value={p.title} onChange={set("title")} />
          </Row>
        </Rows>
      </PanelSection>
      {(hasExtra || showExtra) && (
        <PanelSection label="其他">
          <Rows>
            <Row label="关系">
              <RowInput placeholder="如：同事、同学" value={p.relation} onChange={set("relation")} />
            </Row>
            <Row label="生日">
              <RowInput type="date" value={p.birthday} onChange={set("birthday")} />
            </Row>
          </Rows>
          <PanelTextarea placeholder="备注（可选）" value={p.note} onChange={set("note")} />
        </PanelSection>
      )}
      {!hasExtra && !showExtra && (
        <GhostLink onClick={() => setShowExtra(true)}>＋ 添加字段</GhostLink>
      )}
    </>
  );
}
