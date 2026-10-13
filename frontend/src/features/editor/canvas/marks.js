const OUTWARD = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
};

const BAR_OFFSET = 10;
const FOOT_LENGTH = 12;
const HALF_WIDTH = 6;

/**
 * Give the SVG path of a cardinality mark at the end of an edge.
 * "one" is a short bar across the line. "many" is a crow's foot (DESIGN.md §12.7).
 * @param {number} x The point where the edge meets the table.
 * @param {number} y
 * @param {"left"|"right"|"top"|"bottom"} side The side of the table at that point.
 * @param {"one"|"many"} kind
 * @returns {string}
 */
export function markPath(x, y, side, kind) {
  const [dx, dy] = OUTWARD[side];
  // The across direction is perpendicular to the line.
  const ax = dy;
  const ay = dx;
  if (kind === "one") {
    const bx = x + dx * BAR_OFFSET;
    const by = y + dy * BAR_OFFSET;
    return `M ${bx - ax * HALF_WIDTH} ${by - ay * HALF_WIDTH} L ${bx + ax * HALF_WIDTH} ${by + ay * HALF_WIDTH}`;
  }
  const tx = x + dx * FOOT_LENGTH;
  const ty = y + dy * FOOT_LENGTH;
  return (
    `M ${tx} ${ty} L ${x - ax * HALF_WIDTH} ${y - ay * HALF_WIDTH} ` +
    `M ${tx} ${ty} L ${x + ax * HALF_WIDTH} ${y + ay * HALF_WIDTH}`
  );
}
