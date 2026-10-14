import { createReactBlockSpec, ReactCustomBlockRenderProps } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useEffect, useRef, useState } from "react";
import { blobToDataURL } from "../../lib/media";

const voiceConfig = {
  type: "voice",
  propSchema: {
    ...defaultProps,
    url: { default: "" },
  },
  content: "none",
} as const;

type VoiceProps = ReactCustomBlockRenderProps<typeof voiceConfig>;

function VoiceRender({ block, editor }: VoiceProps) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);

  useEffect(
    () => () => {
      window.clearInterval(timerRef.current);
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        blobToDataURL(blob).then((url) =>
          editor.updateBlock(block, { props: { url } }),
        );
      };
      rec.start();
      recRef.current = rec;
      setSecs(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setSecs((s) => s + 1), 1000);
    } catch {
      setRecording(false);
    }
  };

  const stop = () => {
    window.clearInterval(timerRef.current);
    recRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="bn-voice" contentEditable={false}>
      {block.props.url && !recording && (
        <audio className="bn-voice-audio" controls src={block.props.url} />
      )}
      <div className="bn-voice-actions">
        {recording ? (
          <button type="button" className="bn-voice-btn rec" onMouseDown={(e) => e.preventDefault()} onClick={stop}>
            停止录制（{secs}s）
          </button>
        ) : (
          <button type="button" className="bn-voice-btn" onMouseDown={(e) => e.preventDefault()} onClick={start}>
            {block.props.url ? "重新录制" : "开始录音"}
          </button>
        )}
        {block.props.url && !recording && (
          <button
            type="button"
            className="bn-voice-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.updateBlock(block, { props: { url: "" } })}
          >
            删除
          </button>
        )}
      </div>
    </div>
  );
}

export const VoiceBlock = createReactBlockSpec(voiceConfig, {
  render: (props) => <VoiceRender {...props} />,
});
