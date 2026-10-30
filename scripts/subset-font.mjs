// 把完整 Noto Sans SC 裁成只含常用字的子集，供 PDF 内嵌（矢量文字）。
// 用法：node scripts/subset-font.mjs <源字体> <输出 ttf>
import fs from "node:fs";
import path from "node:path";
import subsetFont from "subset-font";

const src = process.argv[2];
const out = process.argv[3];
if (!src || !out) {
  console.error("用法: node scripts/subset-font.mjs <源字体> <输出.ttf>");
  process.exit(1);
}

/** GB2312 一级汉字（3755 个，按拼音序）+ 常用标点与符号 */
function commonChars() {
  const chars = new Set();

  // 拉丁、数字、标点、常见符号
  for (let c = 0x20; c <= 0x7e; c++) chars.add(String.fromCharCode(c));
  const symbols =
    "　、。〃〈〉《》「」『』【】〔〕〖〗〘〙〚〛〜〝〞〟〰〾〿–—‘’‛“”„‟…‧﹏.,:;!?()[]{}<>+-*/=%&@#$^_|~`'\"\\";
  for (const ch of symbols) chars.add(ch);
  const cjkPunct =
    "·×÷±≤≥≠≈∞∝∴∵∈∉⊂⊃∩∪∑∏√∫∝∠⊥∥⌒※★☆○●◎◇◆□■△▲▽▼§¶†‡•‰‱°℃℉№";
  for (const ch of cjkPunct) chars.add(ch);

  // GB2312 一级汉字：区 16-55，每区 94 字
  for (let qu = 16; qu <= 55; qu++) {
    for (let wei = 1; wei <= 94; wei++) {
      const hi = qu + 0xa0;
      const lo = wei + 0xa0;
      try {
        const ch = new TextDecoder("gbk").decode(new Uint8Array([hi, lo]));
        if (ch && ch.length === 1) chars.add(ch);
      } catch {
        /* 跳过非法码位 */
      }
    }
  }

  // 二级汉字（576-6763）也带上，覆盖生僻一点的名字
  for (let qu = 56; qu <= 87; qu++) {
    for (let wei = 1; wei <= 94; wei++) {
      const hi = qu + 0xa0;
      const lo = wei + 0xa0;
      try {
        const ch = new TextDecoder("gbk").decode(new Uint8Array([hi, lo]));
        if (ch && ch.length === 1) chars.add(ch);
      } catch {
        /* 跳过 */
      }
    }
  }

  // 常用中文标点（GB2312 标点区）与全角字符
  for (let qu = 1; qu <= 9; qu++) {
    for (let wei = 1; wei <= 94; wei++) {
      try {
        const ch = new TextDecoder("gbk").decode(new Uint8Array([qu + 0xa0, wei + 0xa0]));
        if (ch && ch.length === 1) chars.add(ch);
      } catch {
        /* 跳过 */
      }
    }
  }

  return [...chars].join("");
}

const text = commonChars();
console.log(`字符数: ${text.length}`);

const source = fs.readFileSync(src);
const subset = await subsetFont(source, text, { targetFormat: "truetype" });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, subset);
console.log(`输出: ${out} ${(subset.length / 1024 / 1024).toFixed(2)} MB`);
