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

export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
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
