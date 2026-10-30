import type { AppBlock } from "../editor/schema";
import type { NoteDoc } from "../db/notes";
import { listNotes, putNote } from "../db/notes";

/* 仅开发环境使用：?seed=1 时写入一批示例笔记，用来看真实排版。
   不参与生产构建（import.meta.env.DEV 判定 + 动态导入）。 */

type SeedBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content: unknown[];
  children: SeedBlock[];
};

const baseProps = {
  textAlignment: "left",
  backgroundColor: "default",
  textColor: "default",
};

function paragraph(text: string): SeedBlock {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    props: { ...baseProps },
    content: text ? [{ type: "text", text, styles: {} }] : [],
    children: [],
  };
}

function mood(emoji: string, text: string): SeedBlock {
  return {
    id: crypto.randomUUID(),
    type: "mood",
    props: { ...baseProps, emoji },
    content: text ? [{ type: "text", text, styles: {} }] : [],
    children: [],
  };
}

function location(name: string, addr: string): SeedBlock {
  return {
    id: crypto.randomUUID(),
    type: "location",
    props: { ...baseProps, name, addr, coord: "" },
    content: [],
    children: [],
  };
}

function contact(name: string, phone: string, relation: string): SeedBlock {
  return {
    id: crypto.randomUUID(),
    type: "contact",
    props: { ...baseProps, name, phone, relation },
    content: [],
    children: [],
  };
}

function anniversary(title: string, date: string, annual = true): SeedBlock {
  return {
    id: crypto.randomUUID(),
    type: "anniversary",
    props: { ...baseProps, title, date, kind: "anniversary", annual },
    content: [],
    children: [],
  };
}

function checklist(items: { t: string; d: boolean }[]): SeedBlock {
  return {
    id: crypto.randomUUID(),
    type: "checklist",
    props: { ...baseProps, items: JSON.stringify(items) },
    content: [],
    children: [],
  };
}

function bankcard(
  bank: string,
  no: string,
  holder: string,
  kind: "储蓄卡" | "信用卡" | "其他",
  theme: "blue" | "purple" | "teal" | "rose",
): SeedBlock {
  return {
    id: crypto.randomUUID(),
    type: "bankcard",
    props: { ...baseProps, bank, no, holder, kind, theme },
    content: [],
    children: [],
  };
}

const imageSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700"><rect width="1200" height="700" fill="#e9dfc9"/><rect y="380" width="1200" height="320" fill="#d8c9ab"/><circle cx="880" cy="330" r="86" fill="#a8543c" opacity=".9"/><path d="M0 410 L190 340 L350 400 L500 360 L660 416 L810 376 L960 410 L1120 366 L1200 406 L1200 470 L0 470 Z" fill="#6f6a5a" opacity=".55"/><rect y="446" width="1200" height="4" fill="#4c463a" opacity=".55"/><path d="M0 460 H1200 M0 505 H1200 M0 560 H1200" stroke="#8b7f69" stroke-width="1.6" opacity=".5"/><path d="M120 446 L430 446 L480 500 L60 500 Z" fill="#4c463a" opacity=".75"/><path d="M700 446 L990 446 L1030 492 L650 492 Z" fill="#4c463a" opacity=".65"/></svg>`;

function image(url: string, caption: string): SeedBlock {
  return {
    id: crypto.randomUUID(),
    type: "image",
    props: {
      ...baseProps,
      name: "",
      url,
      caption,
      showPreview: true,
      previewWidth: 512,
    },
    content: [],
    children: [],
  };
}

function note(
  title: string,
  date: string,
  time: string,
  blocks: SeedBlock[],
): NoteDoc {
  const [hh, mm] = time.split(":").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  const stamp = new Date(y, m - 1, d, hh, mm).getTime();
  return {
    id: crypto.randomUUID(),
    title,
    date,
    createdAt: stamp,
    updatedAt: stamp,
    blocks: blocks as unknown as AppBlock[],
  };
}

const imageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(imageSvg)}`;

const SAMPLE: NoteDoc[] = [
  note("秋日骑行", "2026-10-20", "18:42", [
    paragraph(
      "沿江骑了十二公里，风比想象中冷。路过桥下的时候看见有人在钓鱼，夕阳把水面切成一条一条的。",
    ),
    mood("😀", "开心 · 松弛"),
    location("闻涛路", "杭州 · 滨江 · 闻涛路"),
    image(imageUrl, "江边，18:24 · 落日与桥墩"),
    paragraph("停下来买了一杯热豆浆，坐在堤岸上，看天色从橙变成灰蓝。"),
    paragraph("回家时天已经黑了。把照片导进笔记里，六张，删掉两张模糊的。"),
  ]),
  note("本周待办", "2026-10-20", "10:05", [
    checklist([
      { t: "周四前交周报", d: false },
      { t: "预约体检 · 下周二上午", d: false },
      { t: "给车做保养", d: true },
    ]),
  ]),
  note("无标题", "2026-10-19", "22:17", [
    paragraph("所谓成熟，就是把力气花在做到的事情上。"),
  ]),
  note("给小林的回信", "2026-10-19", "20:31", [
    paragraph("你说的那家面馆我去过了，汤头确实好，就是排队太久。"),
    contact("小林", "138 0013 8800", "朋友"),
  ]),
  note("雨", "2026-10-19", "16:08", [
    mood("😐", "平静"),
    paragraph("下午开始下雨，窗台上那只猫又来了，蹲了很久。"),
    location("家里", "杭州 · 拱墅"),
  ]),
  note("厨房实验：番茄炖牛腩", "2026-10-18", "19:52", [
    mood("😄", "满足"),
    paragraph("炖了两个半小时，肉烂了，但盐放早了。下次最后十分钟再放。"),
  ]),
  note("十月读书记录", "2026-10-18", "11:20", [
    paragraph("《城与不确定的墙》读完三分之一，划线比想象中多。"),
  ]),
  note("外婆生日", "2026-10-17", "21:06", [
    anniversary("外婆生日", "1960-10-17"),
    paragraph("订了蛋糕，她说不喜欢奶油，最后还是吃了两块。"),
  ]),
  note("会议纪要 · 产品周会", "2026-10-15", "15:40", [
    paragraph("下个版本只做三件事：搜索、导出、纪念日提醒。"),
  ]),
  note("夜跑三公里", "2026-10-14", "21:30", [
    mood("😐", "平静"),
    paragraph("跑到第二公里膝盖有点紧，慢下来走了一段。"),
  ]),
  note("银行卡与发票", "2026-10-13", "09:12", [
    bankcard("招商银行", "6225880123456789", "刘雀", "储蓄卡", "rose"),
    paragraph("报销走这张卡；发票抬头记得写公司全称。"),
  ]),
];

export async function seedIfRequested(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("seed") !== "1") return;
  const existing = await listNotes();
  if (existing.length > 0) return;
  for (const doc of SAMPLE) await putNote(doc);
}
