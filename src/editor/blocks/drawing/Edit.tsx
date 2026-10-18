import { useEffect, useRef, useState } from "react";
import shared from "../_shared/blockCommon.module.css";
import { stopMouseDown } from "../_shared/BlockShell";
import s from "./styles.module.css";
import { COLORS, HEIGHT, WIDTH, type DrawingBlockT, type DrawingEditor } from "./config";

export default function DrawingEdit({
  block,
  editor,
  onDone,
}: {
  block: DrawingBlockT;
  editor: DrawingEditor;
  onDone: () => void;
}) {
  const [color, setColor] = useState(COLORS[0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    if (block.props.data === lastSavedRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (block.props.data) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = block.props.data;
    }
  }, [block.props.data]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = pos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    persist();
  };

  const persist = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    lastSavedRef.current = url;
    editor.updateBlock(block, { props: { data: url } });
  };

  const save = () => {
    persist();
    onDone();
  };

  return (
    <div className={shared.form} contentEditable={false}>
      <div className={s.toolbar}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={c === color ? `${s.color} ${s.colorActive}` : s.color}
            style={{ background: c }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setColor(c)}
            aria-label={`颜色 ${c}`}
          />
        ))}
        <button
          type="button"
          className={s.btn}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const ctx = canvasRef.current?.getContext("2d");
            ctx?.clearRect(0, 0, WIDTH, HEIGHT);
            persist();
          }}
        >
          清空画布
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className={s.canvas}
        width={WIDTH}
        height={HEIGHT}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className={shared.formRow}>
        <button type="button" className={shared.done} onMouseDown={stopMouseDown} onClick={save}>
          完成
        </button>
      </div>
    </div>
  );
}
