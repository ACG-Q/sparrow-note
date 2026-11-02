import { describe, expect, it } from "vitest";
import {
  effectiveState,
  pendingIds,
  permissionRows,
  resultText,
  stateText,
  summarize,
  type PermState,
} from "./permissions";

describe("effectiveState（界面该显示成什么）", () => {
  it("能申请但探不出结果时，说「待授权」而不是「未知」", () => {
    expect(effectiveState("unknown", true)).toBe("prompt");
    expect(stateText(effectiveState("unknown", true))).toBe("待授权");
  });

  it("不能申请的保持未知（比如桌面端的位置）", () => {
    expect(effectiveState("unknown", false)).toBe("unknown");
  });

  it("已允许 / 已拒绝原样保留", () => {
    expect(effectiveState("granted", true)).toBe("granted");
    expect(effectiveState("denied", true)).toBe("denied");
  });
});

describe("summarize（顶部汇总）", () => {
  const rows = permissionRows("android");

  it("按状态分类计数", () => {
    const states: Partial<Record<string, PermState>> = {
      location: "granted",
      microphone: "prompt",
      camera: "denied",
      notification: "unknown",
      files: "granted",
      network: "granted",
    };
    const sum = summarize(rows, states as never);
    expect(sum.granted).toBe(3);
    expect(sum.pending).toBe(2); // microphone + notification（camera 被拒绝，不算待申请）
    expect(sum.blocked).toBe(1);
    expect(sum.fixed).toBe(0);
  });

  it("没探过的能力当「待申请」算", () => {
    const sum = summarize(rows, {});
    expect(sum.pending).toBe(4); // 位置 / 麦克风 / 相机 / 通知
    expect(sum.granted).toBe(0);
  });

  it("不能申请的能力进「不适用」", () => {
    const windows = permissionRows("windows");
    const sum = summarize(windows, {});
    // 桌面端位置不能申请，文件读写 / 网络也不能
    expect(sum.fixed).toBeGreaterThanOrEqual(3);
  });
});

describe("pendingIds（全部申请要问哪些）", () => {
  const rows = permissionRows("android");

  it("跳过已允许、被拒绝和不能申请的", () => {
    const ids = pendingIds(rows, {
      location: "granted",
      microphone: "granted",
      camera: "denied",
      notification: "unknown",
      files: "granted",
      network: "granted",
    });
    expect(ids).toEqual(["notification"]);
  });

  it("全都没探过时只问能申请的那几个", () => {
    const ids = pendingIds(rows, {});
    expect(ids).toEqual(["location", "microphone", "camera", "notification"]);
  });
});

describe("resultText（结果如实说）", () => {
  it("四种结果各有说法", () => {
    expect(resultText("microphone", "granted")).toContain("已允许");
    expect(resultText("notification", "granted")).toContain("提醒");
    expect(resultText("camera", "denied")).toContain("系统设置");
    expect(resultText("camera", "unsupported")).toContain("不支持");
    expect(resultText("camera", "unknown")).toContain("系统设置");
  });
});

describe("permissionRows（各平台的清单差异）", () => {
  it("Android 上位置、麦克风、相机、通知都能就地申请", () => {
    const rows = permissionRows("android");
    const canAsk = rows.filter((r) => r.canRequest).map((r) => r.id);
    expect(canAsk).toEqual(["location", "microphone", "camera", "notification"]);
    expect(rows).toHaveLength(6);
  });

  it("桌面端不给位置申请，并说明去用「搜地点」", () => {
    const loc = permissionRows("windows").find((r) => r.id === "location");
    expect(loc?.canRequest).toBe(false);
    expect(loc?.note).toContain("搜地点");
  });

  it("文件读写与网络不需要申请", () => {
    const rows = permissionRows("web");
    for (const id of ["files", "network"]) {
      expect(rows.find((r) => r.id === id)?.canRequest).toBe(false);
    }
  });

  it("能申请的能力都带「去这里打开」的路径", () => {
    for (const p of ["android", "ios", "windows", "macos", "linux", "web"] as const) {
      const rows = permissionRows(p);
      for (const r of rows) {
        if (r.canRequest) expect(Boolean(r.fixHint), `${p}/${r.id}`).toBe(true);
      }
    }
  });
});
