import { AudioPlayer } from "../_shared/AudioPlayer";
import shared from "../_shared/blockCommon.module.css";
import type { VoiceBlockT } from "./config";

export default function VoiceDisplay({ block }: { block: VoiceBlockT }) {
  if (!block.props.url) {
    return <span className={shared.empty}>点击右上角麦克风开始录音</span>;
  }
  return <AudioPlayer src={block.props.url} label="语音" wave={block.props.wave} />;
}
