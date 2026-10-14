import { createReactBlockSpec, ReactCustomBlockRenderProps } from "@blocknote/react";
import { defaultProps } from "@blocknote/core";
import { PinIcon } from "../icons";

const locationConfig = {
  type: "location",
  propSchema: {
    ...defaultProps,
    name: { default: "" },
    addr: { default: "" },
  },
  content: "none",
} as const;

type LocationProps = ReactCustomBlockRenderProps<typeof locationConfig>;

function LocationRender({ block, editor }: LocationProps) {
  const set = (key: "name" | "addr") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      editor.updateBlock(block, { props: { [key]: e.target.value } });
    };
  const keyword = `${block.props.name} ${block.props.addr}`.trim();
  return (
    <div className="bn-location">
      <span className="bn-location-pin" contentEditable={false}>
        <PinIcon />
      </span>
      <div className="bn-location-body">
        <input
          className="bn-input bn-location-name"
          placeholder="地点名称"
          value={block.props.name}
          onChange={set("name")}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <input
          className="bn-input bn-location-addr"
          placeholder="地址"
          value={block.props.addr}
          onChange={set("addr")}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
      {keyword && (
        <a
          className="bn-location-map"
          href={`https://uri.amap.com/search?keyword=${encodeURIComponent(keyword)}`}
          target="_blank"
          rel="noreferrer noopener"
          contentEditable={false}
          onMouseDown={(e) => e.stopPropagation()}
        >
          地图
        </a>
      )}
    </div>
  );
}

export const LocationBlock = createReactBlockSpec(locationConfig, {
  render: (props) => <LocationRender {...props} />,
});
