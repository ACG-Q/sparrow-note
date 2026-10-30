/** 心情 emoji → 印章字。全站（列表、名目表、汇总、抽屉、编辑态、选择浮层）只显示这一个字。 */
const MOOD_CHAR: Record<string, string> = {
  "😀": "喜",
  "😄": "乐",
  "😐": "平",
  "😢": "低",
  "😡": "怒",
  "🥰": "爱",
  "😴": "倦",
  "🤯": "乱",
  "😎": "爽",
  "😭": "泣",
  "🤒": "病",
  "🥳": "庆",
};

/** 认不出的 emoji（例如块的默认值 🙂）统一落到「平」，不把半个字符渲染出来 */
export function moodChar(emoji: string): string {
  return MOOD_CHAR[emoji] ?? "平";
}

export const MOOD_EMOJIS = Object.keys(MOOD_CHAR);
