import { insertOrUpdateBlockForSlashMenu, filterSuggestionItems } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import {
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import type { AppSchema, AppBlock } from "./schema";
import { BlockIcon } from "./icons";

type AppEditor = BlockNoteEditor<
  AppSchema["blockSchema"],
  AppSchema["inlineContentSchema"],
  AppSchema["styleSchema"]
>;

const customItems: Array<{
  title: string;
  aliases: string[];
  type: AppBlock["type"];
}> = [
  { title: "心情", aliases: ["mood", "xinqing", "xq"], type: "mood" },
  { title: "日子", aliases: ["rizi", "anniversary", "jinianri", "jnr", "daoshuri"], type: "anniversary" },
  { title: "联系人", aliases: ["contact", "lianxiren", "lxr"], type: "contact" },
  { title: "位置", aliases: ["location", "weizhi", "wz", "didian"], type: "location" },
  { title: "清单", aliases: ["checklist", "qingdan", "qd", "daiban"], type: "checklist" },
  { title: "链接", aliases: ["link", "lianjie", "lj", "bookmark"], type: "bookmark" },
  { title: "账号", aliases: ["account", "zhanghao", "zh"], type: "account" },
  { title: "银行卡", aliases: ["bankcard", "yinhangka", "yhk", "bank"], type: "bankcard" },
  { title: "绘图", aliases: ["drawing", "huitu", "ht", "huashou"], type: "drawing" },
  { title: "语音", aliases: ["voice", "yuyin", "yy", "luyin"], type: "voice" },
  { title: "图片", aliases: ["image", "tupian", "tp", "photo"], type: "image" },
  { title: "视频", aliases: ["video", "shipin", "sp"], type: "video" },
];

const DUPLICATE_DEFAULT_TITLES = new Set(["图片", "视频", "Image", "Video"]);

export function getSlashItems(editor: AppEditor): DefaultReactSuggestionItem[] {
  const custom: DefaultReactSuggestionItem[] = customItems.map((item) => ({
    title: item.title,
    aliases: item.aliases,
    group: "麻雀记",
    icon: <BlockIcon type={item.type} />,
    onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: item.type }),
  }));
  const defaults = getDefaultReactSlashMenuItems(editor).filter(
    (item) => !DUPLICATE_DEFAULT_TITLES.has(item.title),
  );
  return [...custom, ...defaults];
}

export function filterSlashItems(
  items: DefaultReactSuggestionItem[],
  query: string,
): DefaultReactSuggestionItem[] {
  return filterSuggestionItems(items, query);
}
