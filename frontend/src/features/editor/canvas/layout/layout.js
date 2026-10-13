import { NEW_TABLES_GAP } from "../constants.js";
import { estimateSize } from "./size.js";

const ELK_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.spacing.nodeNode": "40",
  "elk.layered.spacing.nodeNodeBetweenLayers": "90",
  "elk.spacing.componentComponent": "60",
};

function sizeOf(table, sizes) {
  return sizes?.[table.key] ?? estimateSize(table);
}

/** Run elk on some tables and the refs between them. Return the positions, moved to the origin. */
async function runElk(tables, refs, sizes, elk) {
  const keys = new Set(tables.map((table) => table.key));
  const edges = [];
  for (const ref of refs) {
    const from = ref.from.tableKey;
    const to = ref.to.tableKey;
    // A ref to the same table, or to a table outside the set, does not help the layout.
    if (from !== to && keys.has(from) && keys.has(to)) {
      edges.push({ id: ref.key, sources: [from], targets: [to] });
    }
  }
  const graph = {
    id: "root",
    layoutOptions: ELK_OPTIONS,
    children: tables.map((table) => ({ id: table.key, ...sizeOf(table, sizes) })),
    edges,
  };
  const result = await elk.layout(graph);
  const children = result.children ?? [];
  const minX = Math.min(...children.map((child) => child.x));
  const minY = Math.min(...children.map((child) => child.y));
  const positions = {};
  for (const child of children) {
    positions[child.id] = { x: Math.round(child.x - minX), y: Math.round(child.y - minY) };
  }
  return positions;
}

/**
 * Give a position to each table that has none (EDT-004). The other tables do not move.
 * The new tables go to the right of the box of the current tables, at the top of that box.
 * @param {{ parseResult: object, positions: Record<string, {x: number, y: number}>,
 *   sizes?: Record<string, {width: number, height: number}>, elk: { layout: Function } }} args
 * @returns {Promise<Record<string, {x: number, y: number}>>} Positions of the new tables only.
 */
export async function placeMissing({ parseResult, positions, sizes, elk }) {
  const missing = parseResult.tables.filter((table) => !positions[table.key]);
  if (missing.length === 0) return {};
  const placed = parseResult.tables.filter((table) => positions[table.key]);
  const fresh = await runElk(missing, parseResult.refs, sizes, elk);
  if (placed.length === 0) return fresh;

  let right = -Infinity;
  let top = Infinity;
  for (const table of placed) {
    const { x, y } = positions[table.key];
    right = Math.max(right, x + sizeOf(table, sizes).width);
    top = Math.min(top, y);
  }
  const result = {};
  for (const [key, position] of Object.entries(fresh)) {
    result[key] = { x: position.x + right + NEW_TABLES_GAP, y: position.y + top };
  }
  return result;
}

/**
 * Give a position to all tables.
 * @returns {Promise<Record<string, {x: number, y: number}>>}
 */
export async function arrangeAll({ parseResult, sizes, elk }) {
  if (parseResult.tables.length === 0) return {};
  return runElk(parseResult.tables, parseResult.refs, sizes, elk);
}
