import { memo } from "react";
import { BaseEdge, getSmoothStepPath } from "@xyflow/react";
import { text } from "../../../text/en.js";
import { fill } from "./fill.js";
import { markPath } from "./marks.js";

function describeEnd({ tableKey, columns }) {
  return `${tableKey}.${columns.join(",")}`;
}

/** An edge for one ref. It draws a mark at each end: a bar for "one", a crow's foot for "many". */
function RefEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const description = fill(text.editorCanvas.refTitle, {
    from: describeEnd(data.from),
    to: describeEnd(data.to),
    kind: text.editorCanvas.cardinality[data.cardinality],
  });
  return (
    <g className="canvas-edge">
      <title>{description}</title>
      <BaseEdge id={id} path={path} />
      <path
        className="canvas-edge__mark"
        d={markPath(sourceX, sourceY, sourcePosition, data.fromEnd)}
      />
      <path
        className="canvas-edge__mark"
        d={markPath(targetX, targetY, targetPosition, data.toEnd)}
      />
    </g>
  );
}

export const RefEdge = memo(RefEdgeView);
