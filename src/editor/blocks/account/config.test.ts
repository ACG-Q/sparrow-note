import { describe, expect, it } from "vitest";
import { genPassword, passStrength } from "./config";

describe("passStrength", () => {
  it("空密码 level 0 且无文案", () => {
    expect(passStrength("")).toEqual({ level: 0, label: "" });
  });

  it("短弱密码为「弱」", () => {
    expect(passStrength("abc").level).toBe(0);
    expect(passStrength("abc").label).toBe("弱");
  });

  it("中等与强密码分级正确", () => {
    expect(passStrength("abcdef12").level).toBe(1);
    expect(passStrength("abcdef1234").level).toBe(2);
    expect(passStrength("Abcdef1234!@").level).toBe(3);
    expect(passStrength("Abcdef1234!@").label).toBe("强");
  });
});

describe("genPassword", () => {
  it("默认 16 位且不含易混字符 0/O/1/l", () => {
    const p = genPassword();
    expect(p).toHaveLength(16);
    expect(p).not.toMatch(/[0O1l]/);
  });

  it("可指定长度且字符全部来自字符集", () => {
    const p = genPassword(24);
    expect(p).toHaveLength(24);
    expect(p).toMatch(/^[abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*]+$/);
  });
});
