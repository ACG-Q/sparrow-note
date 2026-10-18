import { describe, expect, it } from "vitest";
import { base32Decode, generateTotpCode, normalizeTotpInput, parseOtpauth } from "./totp";

function decodeText(s: string): string {
  return new TextDecoder().decode(base32Decode(s));
}

describe("base32Decode（RFC 4648）", () => {
  it("解码 fooba", () => {
    expect(decodeText("MZXW6YTB")).toBe("fooba");
  });

  it("解码 foobar（含填充）", () => {
    expect(decodeText("MZXW6YTBOI======")).toBe("foobar");
  });

  it("容忍小写、空格与混淆字符 0/1/8", () => {
    expect(decodeText("mzxw 6ytb")).toBe("fooba");
    expect(decodeText("018")).toBe(decodeText("OIB"));
  });

  it("非法字符抛错", () => {
    expect(() => base32Decode("!!")).toThrow();
  });
});

describe("parseOtpauth", () => {
  const uri = "otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6&period=30";

  it("解析完整 URI", () => {
    const p = parseOtpauth(uri);
    expect(p).not.toBeNull();
    expect(p?.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(p?.digits).toBe(6);
    expect(p?.period).toBe(30);
    expect(p?.issuer).toBe("GitHub");
  });

  it("digits/period 缺省为 6/30", () => {
    const p = parseOtpauth("otpauth://totp/x?secret=JBSWY3DPEHPK3PXP");
    expect(p?.digits).toBe(6);
    expect(p?.period).toBe(30);
  });

  it("缺 secret 或 scheme 不对返回 null", () => {
    expect(parseOtpauth("otpauth://totp/x")).toBeNull();
    expect(parseOtpauth("https://example.com")).toBeNull();
    expect(parseOtpauth("otpauth://totp/x?secret=!!!")).toBeNull();
  });
});

describe("normalizeTotpInput", () => {
  it("纯 base32 输入包装为 otpauth URI", () => {
    const n = normalizeTotpInput("jbswy3dpehpk3pxp");
    expect(n).toBe("otpauth://totp/?secret=JBSWY3DPEHPK3PXP");
  });

  it("otpauth URI 原样透传", () => {
    const uri = "otpauth://totp/x?secret=JBSWY3DPEHPK3PXP";
    expect(normalizeTotpInput(uri)).toBe(uri);
  });

  it("两者皆非法返回 null", () => {
    expect(normalizeTotpInput("key!")).toBeNull();
    expect(normalizeTotpInput("otpauth://totp/x")).toBeNull();
    expect(normalizeTotpInput("")).toBeNull();
  });
});

describe("generateTotpCode（RFC 6238 SHA-1 向量）", () => {
  it("t=59 → 6 位 287082（8 位 94287082 的截断）", async () => {
    const code = await generateTotpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59 * 1000, 6, 30);
    expect(code).toBe("287082");
  });

  it("t=1111111109 → 07081804", async () => {
    const code = await generateTotpCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1111111109 * 1000, 8, 30);
    expect(code).toBe("07081804");
  });

  it("短码补零", async () => {
    const code = await generateTotpCode("AAAAAAAA", 0, 6, 30);
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^\d{6}$/);
  });
});
