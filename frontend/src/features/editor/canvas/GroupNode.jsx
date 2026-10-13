import { memo } from "react";
import { isHexColor } from "./colors.js";

/** The background box of a TableGroup. The color is a style only if it is a hex color. */
function GroupNodeView({ data }) {
  const style = isHexColor(data.color) ? { "--group-color": data.color } : undefined;
  return (
    <div className="canvas-group" style={style}>
      <span className="canvas-group__name">{data.name}</span>
    </div>
  );
}

export const GroupNode = memo(GroupNodeView);
