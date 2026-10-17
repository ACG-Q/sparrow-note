import s from "./styles.module.css";
import type { DrawingBlockT } from "./config";

export default function DrawingDisplay({ block }: { block: DrawingBlockT }) {
  return <img className={s.img} src={block.props.data} alt="手绘" contentEditable={false} />;
}
