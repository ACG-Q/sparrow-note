// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeBlock } from "./CodeBlock";

/**
 * XSS 回归：阅读态代码块用 Shiki 生成 HTML 再 dangerouslySetInnerHTML 注入。
 * Shiki 的契约是「转义代码文本后再包 span」，这条测试把它钉住：
 * 代码里出现 <script> / onerror / <img> 时，DOM 里不能真的出现可执行节点。
 */
describe("CodeBlock 注入安全", () => {
  it("代码里的 <script> 不会变成真 script 节点，且文本原样保留", async () => {
    const code = `<script>alert(1)</script>`;
    const { container } = render(<CodeBlock code={code} language="html" collapseLines={40} />);

    await waitFor(() => expect(container.textContent).toContain("<script>alert(1)</script>"), {
      timeout: 8000,
    });

    expect(container.querySelector("script")).toBeNull();
    // 文本仍然在（只是被转义成文本）
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("onerror 属性不会落到真实元素上", async () => {
    const code = `<img src=x onerror="alert(1)">`;
    const { container } = render(<CodeBlock code={code} language="html" collapseLines={40} />);
    await waitFor(() => expect(container.textContent).toContain("onerror"), { timeout: 8000 });

    const img = container.querySelector("img");
    expect(img).toBeNull();
    expect(container.textContent).toContain("onerror");
  });

  it("正常代码能高亮出 span 结构", async () => {
    const { container } = render(<CodeBlock code={"const a = 1;"} language="javascript" collapseLines={40} />);
    await waitFor(() => expect(container.textContent).toContain("const a = 1;"), { timeout: 8000 });

    const body = container.querySelector("[class*='body']");
    expect(body).not.toBeNull();
    expect(container.textContent).toContain("const a = 1;");
  });
});
