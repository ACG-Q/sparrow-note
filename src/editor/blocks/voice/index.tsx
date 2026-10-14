import { useEffect, useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { blobToDataURL } from "../../../lib/media";
import { voiceConfig, type VoiceProps, type VoiceEditor } from "./config";
import VoiceDisplay from "./Display";
import VoiceEdit from "./Edit";

function VoiceRender({ block, editor }: VoiceProps) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const editorRef = useRef<VoiceEditor>(editor);
  editorRef.current = editor;

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
          editorRef.current.updateBlock(block, { props: { url } }),
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

  if (recording) {
    return <VoiceEdit secs={secs} onStop={stop} />;
  }
  return <VoiceDisplay block={block} editor={editor} onRecord={start} />;
}

export const VoiceBlock = createReactBlockSpec(voiceConfig, {
  render: (props) => <VoiceRender {...props} />,
});
