import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, defaultStyleSpecs } from "@blocknote/core";
import type { BlockNoteEditor } from "@blocknote/core";
import { MoodBlock } from "./blocks/mood/index";
import { ContactBlock } from "./blocks/contact/index";
import { AnniversaryBlock } from "./blocks/anniversary/index";
import { LocationBlock } from "./blocks/location/index";
import { ChecklistBlock } from "./blocks/checklist/index";
import { BookmarkBlock } from "./blocks/bookmark/index";
import { AccountBlock } from "./blocks/account/index";
import { BankcardBlock } from "./blocks/bankcard/index";
import { DrawingBlock } from "./blocks/drawing/index";
import { VoiceBlock } from "./blocks/voice/index";
import { SparrowTableBlock } from "./blocks/sparrowTable/index";
import { AudioBlock } from "./media/audioBlock";
import { CodeBlockEditor } from "./media/codeBlockEditor";

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    // 覆盖默认的 audio 渲染（原生控件太跳戏），块类型和属性名不变
    audio: AudioBlock(),
    // 覆盖默认的 codeBlock 渲染：加语言选择 / 行数 / 复制，类型与内容格式不变
    codeBlock: CodeBlockEditor(),
    mood: MoodBlock(),
    contact: ContactBlock(),
    anniversary: AnniversaryBlock(),
    location: LocationBlock(),
    checklist: ChecklistBlock(),
    bookmark: BookmarkBlock(),
    account: AccountBlock(),
    bankcard: BankcardBlock(),
    drawing: DrawingBlock(),
    voice: VoiceBlock(),
    // 自研表格（P0 只读）：格内可放块，内置 table 做不到
    sparrowTable: SparrowTableBlock(),
  },
  inlineContentSpecs: defaultInlineContentSpecs,
  styleSpecs: defaultStyleSpecs,
});

export type AppSchema = typeof schema;
type Doc = (typeof schema)["BlockNoteEditor"]["document"];
export type AppBlock = Doc extends Array<infer B> ? B : never;
export type AppEditor = BlockNoteEditor<
  AppSchema["blockSchema"],
  AppSchema["inlineContentSchema"],
  AppSchema["styleSchema"]
>;
