import { createReactBlockSpec } from "@blocknote/react";
import { BlockIcon, MicIcon, TrashIcon } from "../../icons";
import { useBlockEdit } from "../_shared/BlockEditContext";
import { ActionBtn, BlockCard } from "../_shared/BlockShell";
import { voiceConfig, type VoiceProps } from "./config";
import VoiceDisplay from "./Display";

function VoiceRender({ block, editor }: VoiceProps) {
  const { pending, open } = useBlockEdit();
  const openRecorder = () =>
    open({
      blockId: block.id,
      container: "modal",
      type: "voice",
      label: "语音",
      iconType: "voice",
    });

  return (
    <BlockCard
      chip={<BlockIcon type="voice" />}
      active={pending?.blockId === block.id}
      onClick={openRecorder}
      actions={
        <>
          <ActionBtn icon={<MicIcon />} label="录音" onClick={openRecorder} />
          {block.props.url && (
            <ActionBtn
              icon={<TrashIcon />}
              label="删除录音"
              danger
              onClick={() => editor.updateBlock(block, { props: { url: "" } })}
            />
          )}
        </>
      }
    >
      <VoiceDisplay block={block} />
    </BlockCard>
  );
}

export const VoiceBlock = createReactBlockSpec(voiceConfig, {
  render: (props) => <VoiceRender {...props} />,
});
