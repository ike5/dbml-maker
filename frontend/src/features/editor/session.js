// Convert API data to the data that the store loads.

/**
 * @param {import("../../lib/api/diagrams.js").Diagram} diagram
 * @param {number} etag
 */
export function fromDiagram(diagram, etag) {
  return {
    diagramId: diagram.id,
    role: diagram.role,
    name: diagram.name,
    source: diagram.source,
    layout: diagram.layout,
    etag,
  };
}

/**
 * A public link is always read only (DESIGN.md §7.6).
 * @param {string} token
 * @param {import("../../lib/api/public.js").PublicDiagram} diagram
 */
export function fromPublicDiagram(token, diagram) {
  return {
    diagramId: token,
    role: "viewer",
    readOnly: true,
    name: diagram.name,
    source: diagram.source,
    layout: diagram.layout,
    etag: 0,
  };
}
