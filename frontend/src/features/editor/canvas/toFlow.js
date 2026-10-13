import { GROUP_LABEL_HEIGHT, GROUP_PADDING, LAYOUT_FORMAT } from "./constants.js";
import { estimateSize } from "./layout/size.js";

export const TABLE_NODE_TYPE = "table";
export const GROUP_NODE_TYPE = "tableGroup";
export const REF_EDGE_TYPE = "ref";

/** The ID of the handle of a column on one side of a table node. */
export function handleId(columnName, side) {
  return `${columnName}:${side}`;
}

// The first column of the ref gives the handle. A composite ref draws one edge.
function columnHandle(table, columns, side) {
  const name = columns?.[0];
  if (name === undefined || !table?.columns.some((column) => column.name === name)) {
    return undefined;
  }
  return handleId(name, side);
}

const CARDINALITY_ENDS = {
  "1-1": ["one", "one"],
  "1-n": ["one", "many"],
  "n-1": ["many", "one"],
  "n-n": ["many", "many"],
};

/** Give the cardinality kind at the "from" end and at the "to" end of a ref. */
export function cardinalityEnds(cardinality) {
  return CARDINALITY_ENDS[cardinality] ?? CARDINALITY_ENDS["1-n"];
}

function rectOf(table, positions, sizes) {
  const position = positions[table.key];
  const { width, height } = sizes?.[table.key] ?? estimateSize(table);
  return { x: position.x, y: position.y, width, height };
}

/**
 * Choose the sides of an edge. If the center of the target is to the right of the center of the
 * source, the edge leaves on the right and enters on the left. If not, it uses the other sides.
 * @returns {{ sourceSide: "left"|"right", targetSide: "left"|"right" }}
 */
export function chooseSides(sourceRect, targetRect) {
  if (sourceRect === targetRect) return { sourceSide: "right", targetSide: "right" };
  const sourceCenter = sourceRect.x + sourceRect.width / 2;
  const targetCenter = targetRect.x + targetRect.width / 2;
  return targetCenter > sourceCenter
    ? { sourceSide: "right", targetSide: "left" }
    : { sourceSide: "left", targetSide: "right" };
}

function buildGroups(parseResult, rects) {
  const nodes = [];
  for (const group of parseResult.groups ?? []) {
    const members = group.tableKeys.map((key) => rects.get(key)).filter(Boolean);
    if (members.length === 0) continue;
    const left = Math.min(...members.map((rect) => rect.x));
    const top = Math.min(...members.map((rect) => rect.y));
    const right = Math.max(...members.map((rect) => rect.x + rect.width));
    const bottom = Math.max(...members.map((rect) => rect.y + rect.height));
    nodes.push({
      id: `group:${group.name}`,
      type: GROUP_NODE_TYPE,
      position: { x: left - GROUP_PADDING, y: top - GROUP_PADDING - GROUP_LABEL_HEIGHT },
      width: right - left + 2 * GROUP_PADDING,
      height: bottom - top + 2 * GROUP_PADDING + GROUP_LABEL_HEIGHT,
      data: { name: group.name, color: group.color },
      // The group is a background. The user cannot select, drag, or focus it.
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
    });
  }
  return nodes;
}

function buildEdges(parseResult, rects, tablesByKey) {
  const edges = [];
  for (const ref of parseResult.refs) {
    const sourceRect = rects.get(ref.from.tableKey);
    const targetRect = rects.get(ref.to.tableKey);
    if (!sourceRect || !targetRect) continue;
    const { sourceSide, targetSide } = chooseSides(sourceRect, targetRect);
    const [fromEnd, toEnd] = cardinalityEnds(ref.cardinality);
    edges.push({
      id: ref.key,
      type: REF_EDGE_TYPE,
      source: ref.from.tableKey,
      target: ref.to.tableKey,
      sourceHandle: columnHandle(tablesByKey.get(ref.from.tableKey), ref.from.columns, sourceSide),
      targetHandle: columnHandle(tablesByKey.get(ref.to.tableKey), ref.to.columns, targetSide),
      data: {
        cardinality: ref.cardinality,
        fromEnd,
        toEnd,
        from: { tableKey: ref.from.tableKey, columns: ref.from.columns },
        to: { tableKey: ref.to.tableKey, columns: ref.to.columns },
      },
    });
  }
  return edges;
}

/**
 * Turn a parse result into React Flow nodes and edges (DESIGN.md §12.7).
 * A table without a position makes no node, because the layout (EDT-004) gives it a position.
 * The edges and the group boxes use the positions, so call this function again when a table moves.
 * @param {object} parseResult The parse result of DESIGN.md §13.2.
 * @param {Record<string, {x: number, y: number}>} positions Positions by table key.
 * @param {Record<string, {width: number, height: number}>} [sizes] Measured sizes by table key.
 *   If a size is not here, the function estimates it.
 * @returns {{ nodes: object[], edges: object[] }} The group nodes come first, so they are behind.
 */
export function toNodesAndEdges(parseResult, positions, sizes) {
  const rects = new Map();
  const tableNodes = [];
  const tablesByKey = new Map();
  for (const table of parseResult.tables) {
    if (!positions[table.key]) continue;
    tablesByKey.set(table.key, table);
    rects.set(table.key, rectOf(table, positions, sizes));
    tableNodes.push({
      id: table.key,
      type: TABLE_NODE_TYPE,
      position: { x: positions[table.key].x, y: positions[table.key].y },
      data: { table },
      // React Flow loses a size that the node does not carry, so give back each measured size.
      ...(sizes?.[table.key] && { measured: sizes[table.key] }),
    });
  }
  return {
    nodes: [...buildGroups(parseResult, rects), ...tableNodes],
    edges: buildEdges(parseResult, rects, tablesByKey),
  };
}

/**
 * Make the full layout (DESIGN.md §7.2) for the tables of a parse result.
 * @param {object} parseResult
 * @param {Record<string, {x: number, y: number}>} positions
 * @returns {{ format: 1, tables: Record<string, {x: number, y: number}> }}
 */
export function toLayout(parseResult, positions) {
  const tables = {};
  for (const table of parseResult.tables) {
    const position = positions[table.key];
    if (position) tables[table.key] = { x: position.x, y: position.y };
  }
  return { format: LAYOUT_FORMAT, tables };
}
