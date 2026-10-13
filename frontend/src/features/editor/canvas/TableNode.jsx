import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { text } from "../../../text/en.js";
import { contrastText, isHexColor } from "./colors.js";
import { fill } from "./fill.js";
import { handleId } from "./toFlow.js";

const t = text.editorCanvas;

function Marks({ column }) {
  return (
    <span className="canvas-table__marks">
      {column.pk && (
        <span className="canvas-table__mark" title={t.titlePrimaryKey}>
          {t.markPrimaryKey}
        </span>
      )}
      {column.notNull && (
        <span className="canvas-table__mark" title={t.titleNotNull}>
          {t.markNotNull}
        </span>
      )}
      {column.unique && (
        <span className="canvas-table__mark" title={t.titleUnique}>
          {t.markUnique}
        </span>
      )}
    </span>
  );
}

/**
 * One table. All text is React text, so React escapes it (EDT-005, DESIGN.md §4.7).
 * The header color is a style only if it is a hex color.
 */
function TableNodeView({ data }) {
  const { table } = data;
  const title =
    table.schema && table.schema !== "public" ? `${table.schema}.${table.name}` : table.name;
  const headerStyle = isHexColor(table.headerColor)
    ? { background: table.headerColor, color: contrastText(table.headerColor) }
    : undefined;
  return (
    <div className="canvas-table">
      <div
        className="canvas-table__header"
        style={headerStyle}
        title={table.note ? fill(t.tableNote, { note: table.note }) : undefined}
      >
        {title}
      </div>
      {table.columns.map((column) => (
        <div
          className="canvas-table__row"
          key={column.name}
          title={
            column.note ? fill(t.columnNote, { name: column.name, note: column.note }) : undefined
          }
        >
          <Handle
            type="source"
            position={Position.Left}
            id={handleId(column.name, "left")}
            isConnectable={false}
          />
          <span className="canvas-table__name">{column.name}</span>
          <span className="canvas-table__type">{column.type}</span>
          <Marks column={column} />
          <Handle
            type="source"
            position={Position.Right}
            id={handleId(column.name, "right")}
            isConnectable={false}
          />
        </div>
      ))}
    </div>
  );
}

export const TableNode = memo(TableNodeView);
