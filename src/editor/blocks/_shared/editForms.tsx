import type { ReactElement } from "react";
import type { AppBlock, AppEditor } from "../../schema";
import AnniversaryEdit from "../anniversary/Edit";
import type { AnniversaryBlockT, AnniversaryEditor } from "../anniversary/config";
import ContactEdit from "../contact/Edit";
import type { ContactBlockT, ContactEditor } from "../contact/config";

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
};
