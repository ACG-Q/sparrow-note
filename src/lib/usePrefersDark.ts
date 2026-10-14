import { useEffect, useState } from "react";
import { useThemePref } from "./theme";

export function usePrefersDark(): boolean {
  const pref = useThemePref();
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (pref !== "auto") return pref === "dark";
  return systemDark;
}
