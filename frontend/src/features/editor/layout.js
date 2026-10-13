// Helpers for the layout JSON of a diagram (DESIGN.md §7.2).

/** @typedef {import("../../lib/api/diagrams.js").Layout} Layout */

/**
 * Make a valid layout from stored data. The server keeps the layout as free JSON, so the
 * editor must accept a missing layout, an old format, and bad entries.
 * @param {unknown} layout
 * @returns {Layout}
 */
export function normalizeLayout(layout) {
  const tables = {};
  const given = layout && typeof layout === "object" ? /** @type {any} */ (layout).tables : null;
  if (given && typeof given === "object") {
    for (const [name, position] of Object.entries(given)) {
      if (Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
        tables[name] = { x: position.x, y: position.y };
      }
    }
  }
  return { format: 1, tables };
}

/**
 * @param {Layout} a
 * @param {Layout} b
 * @returns {boolean} True if both layouts have the same table positions.
 */
export function layoutsEqual(a, b) {
  if (a === b) return true;
  const namesA = Object.keys(a.tables);
  if (namesA.length !== Object.keys(b.tables).length) return false;
  return namesA.every((name) => {
    const other = b.tables[name];
    return other && other.x === a.tables[name].x && other.y === a.tables[name].y;
  });
}
