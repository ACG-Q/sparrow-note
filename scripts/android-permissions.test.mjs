import { describe, expect, it } from "vitest";
import { ensureUsesPermissions } from "./android-permissions.mjs";

const template = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />

    <application android:label="x">
        <activity android:name=".MainActivity" />
    </application>
</manifest>
`;

describe("ensureUsesPermissions", () => {
  it("缺哪条补哪条，插在已有 uses-permission 之后", () => {
    const { xml, added } = ensureUsesPermissions(template);
    expect(added).toEqual([
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.MANAGE_EXTERNAL_STORAGE",
    ]);
    expect(xml).toContain('<uses-permission android:name="android.permission.INTERNET" />');
    expect(xml).toContain('<uses-permission android:name="android.permission.CAMERA" />');
    expect(xml).toContain('<uses-permission android:name="android.permission.RECORD_AUDIO" />');
    expect(xml).toContain(
      '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
    );
    // 还在 <application> 之前（插错位置清单就无效了）
    expect(xml.indexOf("android.permission.CAMERA")).toBeLessThan(xml.indexOf("<application"));
  });

  it("重复运行不会重复插入", () => {
    const once = ensureUsesPermissions(template).xml;
    const twice = ensureUsesPermissions(once);
    expect(twice.added).toEqual([]);
    expect(twice.xml).toBe(once);
  });

  it("只补缺的那一条", () => {
    const partial = template.replace(
      "    <uses-permission android:name=\"android.permission.INTERNET\" />\n",
      '    <uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />\n',
    );
    const { xml, added } = ensureUsesPermissions(partial);
    expect(added).toEqual([
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.MANAGE_EXTERNAL_STORAGE",
    ]);
    expect(xml.match(/android.permission.CAMERA/g)).toHaveLength(1);
  });

  it("清单里一条 uses-permission 都没有时插在 manifest 之后", () => {
    const bare = '<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n</manifest>\n';
    const { xml, added } = ensureUsesPermissions(bare);
    expect(added).toHaveLength(4);
    expect(xml.indexOf("<uses-permission")).toBeGreaterThan(xml.indexOf("<manifest"));
  });

  it("结构不认识时原样返回，不把清单改坏", () => {
    const weird = "not xml at all";
    expect(ensureUsesPermissions(weird)).toEqual({ xml: weird, added: [] });
  });
});
