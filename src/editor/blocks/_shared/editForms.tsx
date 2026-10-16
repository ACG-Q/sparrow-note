import type { ReactElement } from "react";
import type { AppBlock, AppEditor } from "../../schema";

export type PanelFormProps = {
  block: AppBlock;
  editor: AppEditor;
  onDone: () => void;
  onCancel: () => void;
};

export const EDIT_FORMS: Record<string, (p: PanelFormProps) => ReactElement> = {};
