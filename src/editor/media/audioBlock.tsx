import { useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { ActionBtn, BlockCard, stopMouseDown } from "../blocks/_shared/BlockShell";
import { AudioPlayer } from "../blocks/_shared/AudioPlayer";
import { PencilIcon, TrashIcon } from "../icons";
import { audioWaveform, checkAudioFile, fileToDataURL, packWave } from "../../lib/media";
import s from "./audioBlock.module.css";

/**
 * 替换 BlockNote 默认的 audio 块渲染：原生 <audio controls> 跟整站的排印风格差太远。
 * 没有音频时直接给一个「选文件 / 贴链接」的面板，不再弹浏览器 prompt。
 */
export const AudioBlock = createReactBlockSpec(
  {
    type: "audio",
    propSchema: {
      ...defaultProps,
      url: { default: "" },
      name: { default: "" },
      caption: { default: "" },
      showPreview: { default: true },
      previewWidth: { default: 512 },
      wave: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => {
      const hasAudio = Boolean(block.props.url);
      const [picking, setPicking] = useState(!hasAudio);
      const [link, setLink] = useState("");
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState("");
      const fileRef = useRef<HTMLInputElement>(null);

      const apply = async (url: string, name: string) => {
        setBusy(true);
        setErr("");
        let wave = "";
        try {
          wave = packWave(await audioWaveform(url));
        } catch {
          wave = "";
        }
        editor.updateBlock(block, { props: { url, name, wave } });
        setBusy(false);
        setPicking(false);
        setLink("");
      };

      const pickFile = async (file: File) => {
        const check = checkAudioFile(file);
        if (!check.ok) {
          setErr(check.error);
          return;
        }
        const url = await fileToDataURL(file);
        await apply(url, file.name);
      };

      return (
        <div className={s.wrap}>
          <BlockCard
            active={picking}
            alwaysActions={!hasAudio}
            actions={
              hasAudio ? (
                <>
                  <ActionBtn icon={<PencilIcon />} label="替换音频" onClick={() => setPicking((v) => !v)} />
                  <ActionBtn
                    icon={<TrashIcon />}
                    label="删除音频"
                    danger
                    onClick={() => {
                      editor.updateBlock(block, { props: { url: "", wave: "", name: "" } });
                      setPicking(true);
                    }}
                  />
                </>
              ) : null
            }
          >
            {hasAudio ? (
              <AudioPlayer src={block.props.url} label={block.props.name || "音频"} wave={block.props.wave} />
            ) : (
              <span className={s.emptyHint}>
                还没有音频 · 选一个文件，或粘贴链接
                <button
                  type="button"
                  className={s.emptyBtn}
                  onMouseDown={stopMouseDown}
                  onClick={() => setPicking(true)}
                >
                  添加
                </button>
              </span>
            )}
          </BlockCard>

          {picking && (
            <div className={s.picker} contentEditable={false}>
              <div className={s.pickerHead}>
                <span className={s.pickerTitle}>音频</span>
                <button
                  type="button"
                  className={s.pickerClose}
                  onMouseDown={stopMouseDown}
                  onClick={() => setPicking(false)}
                  aria-label="关闭"
                >
                  ✕
                </button>
              </div>

              <div className={s.row}>
                <button
                  type="button"
                  className={s.primary}
                  onMouseDown={stopMouseDown}
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  {busy ? "处理中…" : "选择音频文件"}
                </button>
                <span className={s.hint}>mp3 / wav / m4a / webm，20MB 以内</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void pickFile(f);
                  }}
                />
              </div>

              <div className={s.row}>
                <input
                  className={s.input}
                  value={link}
                  placeholder="或粘贴音频链接（https:// 或 data:）"
                  onChange={(e) => setLink(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && link.trim()) void apply(link.trim(), "");
                  }}
                />
                <button
                  type="button"
                  className={s.ghost}
                  onMouseDown={stopMouseDown}
                  disabled={!link.trim() || busy}
                  onClick={() => void apply(link.trim(), "")}
                >
                  使用
                </button>
              </div>

              {err && <p className={s.err}>{err}</p>}
            </div>
          )}
        </div>
      );
    },
  },
);
