import { describe, expect, it } from "vitest";
import { nextThemePref, themeLabel } from "./theme";

describe("nextThemePref", () => {
  it("cycles light → dark → auto → light", () => {
    expect(nextThemePref("light")).toBe("dark");
    expect(nextThemePref("dark")).toBe("auto");
    expect(nextThemePref("auto")).toBe("light");
  });
});

describe("themeLabel", () => {
  it("returns Chinese labels for each preference", () => {
    expect(themeLabel("light")).toBe("浅色");
    expect(themeLabel("dark")).toBe("深色");
    expect(themeLabel("auto")).toBe("跟随系统");
  });
});
