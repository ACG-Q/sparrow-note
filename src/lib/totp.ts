export interface TotpParams {
  secret: string;
  digits: number;
  period: number;
  issuer?: string;
}

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Uint8Array<ArrayBuffer> {
  const clean = input
    .toUpperCase()
    .replace(/[\s=]/g, "")
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/8/g, "B");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error(`非法 base32 字符: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function parseOtpauth(uri: string): TotpParams | null {
  try {
    const u = new URL(uri);
    if (u.protocol !== "otpauth:" || u.host !== "totp") return null;
    const secret = u.searchParams.get("secret");
    if (!secret) return null;
    try {
      base32Decode(secret);
    } catch {
      return null;
    }
    const digits = Number(u.searchParams.get("digits") ?? "6");
    const period = Number(u.searchParams.get("period") ?? "30");
    const issuer = u.searchParams.get("issuer") ?? undefined;
    return {
      secret,
      digits: Number.isFinite(digits) && digits >= 4 ? digits : 6,
      period: Number.isFinite(period) && period >= 10 ? period : 30,
      issuer,
    };
  } catch {
    return null;
  }
}

export function normalizeTotpInput(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (s.toLowerCase().startsWith("otpauth://")) {
    const p = parseOtpauth(s);
    return p ? s : null;
  }
  try {
    const bytes = base32Decode(s);
    if (bytes.length < 1) return null;
    return `otpauth://totp/?secret=${s.replace(/[\s=]/g, "").toUpperCase()}`;
  } catch {
    return null;
  }
}

export async function generateTotpCode(
  secret: string,
  atMs: number,
  digits = 6,
  period = 30,
): Promise<string> {
  const keyBytes = base32Decode(secret);
  const counter = Math.floor(atMs / 1000 / period);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const offset = sig[sig.length - 1] & 0x0f;
  const bin =
    ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}
