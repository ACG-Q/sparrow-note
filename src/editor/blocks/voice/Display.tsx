import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { VoiceBlockT, VoiceEditor } from "./config";

export default function VoiceDisplay({
  block,
  editor,
  onRecord,
}: {
  block: VoiceBlockT;
  editor: VoiceEditor;
  onRecord: () => void;
}) {
  return (
    <div className={s.root} contentEditable={false}>
      {block.props.url && <audio className={s.audio} controls src={block.props.url} />}
      <div className={s.actions}>
        <button type="button" className={s.btn} onMouseDown={(e) => e.preventDefault()} onClick={onRecord}>
          {block.props.url ? "重新录制" : "开始录音"}
        </button>
        {block.props.url && (
          <button
            type="button"
            className={s.btn}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.updateBlock(block, { props: { url: "" } })}
          >
            删除
          </button>
        )}
      </div>
      {!block.props.url && <span className={shared.muted}>点击「开始录音」录制语音</span>}
    </div>
  );
}
