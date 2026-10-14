import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs, defaultStyleSpecs } from "@blocknote/core";
import { MoodBlock } from "./blocks/mood";
import { ContactBlock } from "./blocks/contact";
import { AnniversaryBlock } from "./blocks/anniversary";
import { LocationBlock } from "./blocks/location";
import { ChecklistBlock } from "./blocks/checklist";
import { BookmarkBlock } from "./blocks/bookmark";
import { AccountBlock } from "./blocks/account";
import { BankcardBlock } from "./blocks/bankcard";
import { DrawingBlock } from "./blocks/drawing";
import { VoiceBlock } from "./blocks/voice";

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
