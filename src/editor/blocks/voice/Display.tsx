import s from "./styles.module.css";
import shared from "../_shared/blockCommon.module.css";
import type { VoiceBlockT } from "./config";

export default function VoiceDisplay({ block }: { block: VoiceBlockT }) {
  if (!block.props.url) {
    return <span className={shared.empty}>点击右上角麦克风开始录音</span>;
  }
  return <audio className={s.audio} controls src={block.props.url} contentEditable={false} />;
}
