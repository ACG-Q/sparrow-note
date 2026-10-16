import type { ReactElement } from "react";
import type { AppBlock, AppEditor } from "../../schema";
import AnniversaryEdit from "../anniversary/Edit";
import type { AnniversaryBlockT, AnniversaryEditor } from "../anniversary/config";
import ContactEdit from "../contact/Edit";
import type { ContactBlockT, ContactEditor } from "../contact/config";
import LocationEdit from "../location/Edit";
import type { LocationBlockT, LocationEditor } from "../location/config";
import AccountEdit from "../account/Edit";
import type { AccountBlockT, AccountEditor } from "../account/config";
import BookmarkEdit from "../bookmark/Edit";
import type { BookmarkBlockT, BookmarkEditor } from "../bookmark/config";

export type PanelFormProps = {
  block: AppBlock;
  editor: AppEditor;
  onDone: () => void;
  onCancel: () => void;
};

export const EDIT_FORMS: Record<string, (p: PanelFormProps) => ReactElement> = {
  anniversary: ({ block, editor }) => (
    <AnniversaryEdit
      block={block as unknown as AnniversaryBlockT}
      editor={editor as unknown as AnniversaryEditor}
    />
  ),
  contact: ({ block, editor }) => (
    <ContactEdit
      block={block as unknown as ContactBlockT}
      editor={editor as unknown as ContactEditor}
    />
  ),
  location: ({ block, editor }) => (
    <LocationEdit
      block={block as unknown as LocationBlockT}
      editor={editor as unknown as LocationEditor}
    />
  ),
  account: ({ block, editor }) => (
    <AccountEdit
      block={block as unknown as AccountBlockT}
      editor={editor as unknown as AccountEditor}
    />
  ),
  bookmark: ({ block, editor }) => (
    <BookmarkEdit
      block={block as unknown as BookmarkBlockT}
      editor={editor as unknown as BookmarkEditor}
    />
  ),
};
