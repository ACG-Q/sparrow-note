import { insertOrUpdateBlockForSlashMenu, filterSuggestionItems } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import {
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import type { AppSchema, AppBlock } from "./schema";
import { emptySparrowTable } from "../lib/tableData";
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
  { title: "大表格", aliases: ["dabg", "zbybg", "zibiao", "sparrowtable", "grid"], type: "sparrowTable" },
  { title: "图片", aliases: ["image", "tupian", "tp", "photo"], type: "image" },
  { title: "视频", aliases: ["video", "shipin", "sp"], type: "video" },
];

const DUPLICATE_DEFAULT_TITLES = new Set(["图片", "视频", "Image", "Video"]);

/** 标准块（BlockNote 默认项）的拼音别名。
    每个词条给三种形态：逐字首字母（yxlb）、全拼（youxuliebiao）、常用缩写（lb）。
    第一版把「有序 / 无序列表」写成了 ylb / wlb，那不是逐字首字母，所以 /yxlb 打不出来。 */
const STANDARD_ALIASES: Record<string, string[]> = {
  一级标题: ["bt", "bt1", "h1", "yjbt", "yijibiaoti", "biaoti"],
  二级标题: ["bt", "bt2", "h2", "ejbt", "erjibiaoti", "biaoti"],
  三级标题: ["bt", "bt3", "h3", "sjbt", "sanjibiaoti", "biaoti"],
  四级标题: ["bt", "bt4", "h4", "sijbt", "sijibiaoti", "biaoti"],
  五级标题: ["bt", "bt5", "h5", "wjbt", "wujibiaoti", "biaoti"],
  六级标题: ["bt", "bt6", "h6", "ljbt", "liujibiaoti", "biaoti"],
  可折叠一级标题: ["kzd", "kzd1", "zhedie", "zhedie1", "kzdyjbt"],
  可折叠二级标题: ["kzd", "kzd2", "zhedie", "zhedie2", "kzdejbt"],
  可折叠三级标题: ["kzd", "kzd3", "zhedie", "zhedie3", "kzdsjbt"],
  引用: ["yy", "quote", "yinyong", "yyin"],
  可折叠列表: ["kzd", "lb", "kzdlb", "zhedie", "zhedielb"],
  有序列表: ["lb", "yxlb", "ol", "youxu", "youlie", "youxuliebiao"],
  无序列表: ["lb", "wxlb", "ul", "wuxu", "wulie", "wuxuliebiao"],
  检查清单: ["qd", "jcqd", "jcbd", "jiancha", "todo", "check"],
  段落: ["dl", "duanluo", "duan", "p", "paragraph"],
  代码块: ["dm", "dmk", "daima", "daimakuai", "code"],
  分隔线: ["fg", "fgx", "fenge", "fengexian", "hr", "divider"],
  表格: ["bg", "biaoge", "table"],
  音频: ["yp", "yinpin", "audio"],
  文件: ["wj", "wenjian", "file"],
  表情符号: ["bq", "bqfh", "biaoqing", "emoji"],
};

export function getSlashItems(editor: AppEditor): DefaultReactSuggestionItem[] {
  const custom: DefaultReactSuggestionItem[] = customItems.map((item) => ({
    title: item.title,
    aliases: item.aliases,
    group: "麻雀记",
    icon: <BlockIcon type={item.type} />,
    onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: item.type }),
  }));
  // 自研表格：插入时给一张空表（1 行表头 + 2 行 × 3 列），否则空数据没法渲染
  const sparrow = custom.findIndex((item) => item.title === "大表格");
  if (sparrow >= 0) {
    custom[sparrow] = {
      title: "大表格",
      aliases: ["dabg", "dabiaoge", "zibiao", "sparrowtable", "grid"],
      group: "麻雀记",
      icon: <BlockIcon type="sparrowTable" />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, {
        type: "sparrowTable",
        props: { data: emptySparrowTable() },
      }),
    };
  }

  const defaults = getDefaultReactSlashMenuItems(editor)
    .filter((item) => !DUPLICATE_DEFAULT_TITLES.has(item.title))
    .map((item) => {
      const extra = STANDARD_ALIASES[item.title];
      if (!extra) return item;
      return { ...item, aliases: [...(item.aliases ?? []), ...extra] };
    });
  return [...custom, ...defaults];
}

export function filterSlashItems(
  items: DefaultReactSuggestionItem[],
  query: string,
): DefaultReactSuggestionItem[] {
  return filterSuggestionItems(items, query);
}
