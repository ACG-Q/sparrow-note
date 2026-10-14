import { createReactBlockSpec, ReactCustomBlockRenderProps } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { useEffect, useRef, useState } from "react";

const WIDTH = 720;
const HEIGHT = 320;
const COLORS = ["#191919", "#e03e3e", "#2383e2", "#0f7b6c", "#f59e0b", "#8b5cf6"];

const drawingConfig = {
  type: "drawing",
  propSchema: {
    ...defaultProps,
    data: { default: "" },
  },
  content: "none",
} as const;

type DrawingProps = ReactCustomBlockRenderProps<typeof drawingConfig>;

function DrawingRender({ block, editor }: DrawingProps) {
  const [editing, setEditing] = useState(!block.props.data);
  const [color, setColor] = useState(COLORS[0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
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
  }, [editing, block.props.data]);

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
    drawingRef.current = false;
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    editor.updateBlock(block, { props: { data: canvas.toDataURL("image/png") } });
    setEditing(false);
  };

  if (!editing && block.props.data) {
    return (
      <div className="bn-drawing" contentEditable={false}>
        <img className="bn-drawing-img" src={block.props.data} alt="手绘" />
        <div className="bn-drawing-actions">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEditing(true)}
          >
            编辑
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.updateBlock(block, { props: { data: "" } })}
          >
            删除
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bn-drawing" contentEditable={false}>
      <div className="bn-drawing-toolbar">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={c === color ? "bn-drawing-color active" : "bn-drawing-color"}
            style={{ background: c }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setColor(c)}
            aria-label={`颜色 ${c}`}
          />
        ))}
        <button
          type="button"
          className="bn-drawing-clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const ctx = canvasRef.current?.getContext("2d");
            ctx?.clearRect(0, 0, WIDTH, HEIGHT);
          }}
        >
          清空
        </button>
        <button type="button" className="bn-drawing-save" onMouseDown={(e) => e.preventDefault()} onClick={save}>
          完成
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="bn-drawing-canvas"
        width={WIDTH}
        height={HEIGHT}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
    </div>
  );
}

export const DrawingBlock = createReactBlockSpec(drawingConfig, {
  render: (props) => <DrawingRender {...props} />,
});
