import { useEffect, useMemo, useRef } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { zh } from "@blocknote/core/locales";
import {
  useEditorChange,
  SuggestionMenuController,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { schema, type AppBlock } from "./schema";
import { getSlashItems, filterSlashItems } from "./slashMenu";
import { usePrefersDark } from "../lib/usePrefersDark";
import { fileToDataURL } from "../lib/media";

function createEditorInstance(initialContent?: AppBlock[]) {
  return BlockNoteEditor.create({
    schema,
    dictionary: zh,
    uploadFile: (file: File) => fileToDataURL(file),
    ...(initialContent && initialContent.length > 0 ? { initialContent } : {}),
  });
}

export function NoteEditor({
  initialContent,
  onChange,
}: {
  initialContent?: AppBlock[];
  onChange: (blocks: AppBlock[]) => void;
}) {
  const editor = useMemo(() => createEditorInstance(initialContent), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const timerRef = useRef<number>(0);

  useEditorChange((ed) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onChangeRef.current(ed.document as AppBlock[]);
    }, 400);
  }, editor);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const slashItems = useMemo(() => getSlashItems(editor), [editor]);
  const dark = usePrefersDark();

  return (
    <BlockNoteView
      editor={editor}
      className="bn-editor"
      data-theming="default"
      theme={dark ? "dark" : "light"}
      slashMenu={false}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) => filterSlashItems(slashItems, query)}
      />
    </BlockNoteView>
  );
}
