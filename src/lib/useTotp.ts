import { useEffect, useMemo, useState } from "react";
import { generateTotpCode, parseOtpauth } from "./totp";

export interface TotpState {
  code: string;
  remain: number;
  period: number;
}

export function useTotp(uri: string): TotpState | null {
  const params = useMemo(() => parseOtpauth(uri), [uri]);
  const [state, setState] = useState<TotpState | null>(null);

  const secret = params?.secret;
  const digits = params?.digits;
  const period = params?.period;

  useEffect(() => {
    if (!secret || !period || !digits) {
      setState(null);
      return;
    }
    let alive = true;
    let cached: { counter: number; code: string } | null = null;
    const tick = async () => {
      const now = Date.now();
      const counter = Math.floor(now / 1000 / period);
      const remain = period - Math.floor((now / 1000) % period);
      let code: string;
      if (cached && cached.counter === counter) {
        code = cached.code;
      } else {
        code = await generateTotpCode(secret, now, digits, period);
        cached = { counter, code };
      }
      if (alive) setState({ code, remain, period });
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [secret, digits, period]);

  return state;
}
