import { useEffect, useMemo, useRef } from "react";
import { BlockNoteEditor } from "@blocknote/core";
import { zh } from "@blocknote/core/locales";
import {
  useEditorChange,
  SuggestionMenuController,
  SideMenuController,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { syntaxHighlighter } from "@blocknote/code-block";
import { schema, type AppBlock } from "./schema";
import { createDebouncedSink } from "./debouncedSink";
import { getSlashItems, filterSlashItems } from "./slashMenu";
import { BlockEditProvider } from "./blocks/_shared/BlockEditContext";
import { EditHost } from "./blocks/_shared/EditHost";
import { TableToolbar } from "./media/TableToolbar";
import { TableSideMenu } from "./media/TableSideMenu";
import { TableMultiSelectLayer } from "./media/TableMultiSelect";
import { usePrefersDark } from "../lib/usePrefersDark";
import { fileToDataURL } from "../lib/media";

function createEditorInstance(initialContent?: AppBlock[]) {
  return BlockNoteEditor.create({
    schema,
    dictionary: zh,
    uploadFile: (file: File) => fileToDataURL(file),
    // 表头行/列切换、单元格合并拆分：BlockNote 默认关闭，表格工具栏和侧栏菜单都依赖它
    tables: { headers: true, splitCells: true },
    // 代码块语法高亮（Shiki，随包带 46 种语言），语言列表也由它提供
    extensions: [syntaxHighlighter],
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

  // 防抖落盘：卸载时 flush（以前只 clearTimeout，最后一句会静默丢失）
  const sink = useMemo(
    () => createDebouncedSink<AppBlock[]>(400, (blocks) => onChangeRef.current(blocks)),
    [],
  );
  useEditorChange((ed) => {
    sink.push(ed.document as AppBlock[]);
  }, editor);
  useEffect(() => () => sink.flush(), [sink]);

  const slashItems = useMemo(() => getSlashItems(editor), [editor]);
  const dark = usePrefersDark();

  return (
    <BlockEditProvider editor={editor}>
      <div style={{ position: "relative" }}>
        <BlockNoteView
          editor={editor}
          data-theming="default"
          theme={dark ? "dark" : "light"}
          slashMenu={false}
          sideMenu={false}
        >
          <SideMenuController sideMenu={TableSideMenu} />
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) => filterSlashItems(slashItems, query)}
          />
        </BlockNoteView>
        <EditHost />
        <TableToolbar editor={editor} />
        <TableMultiSelectLayer editor={editor} />
      </div>
    </BlockEditProvider>
  );
}
