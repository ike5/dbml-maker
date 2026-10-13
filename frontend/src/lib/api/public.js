// Endpoints for a public link (DESIGN.md §7.6, §7.11).
import { apiRequest } from "./client.js";
import { parseEtag } from "./diagrams.js";

/**
 * @typedef {{ name: string, source: string, layout: import("./diagrams.js").Layout, updated_at: string }} PublicDiagram
 */

/**
 * @param {string} token
 * @returns {Promise<PublicDiagram>}
 */
export async function getPublicDiagram(token) {
  const { data } = await apiRequest("GET", `/api/v1/public/${encodeURIComponent(token)}`);
  return data;
}

/**
 * Copy a public diagram to the workspace of the caller.
 * @param {string} token
 * @returns {Promise<import("./diagrams.js").DiagramResult>}
 */
export async function duplicatePublicDiagram(token) {
  const { data, headers } = await apiRequest(
    "POST",
    `/api/v1/public/${encodeURIComponent(token)}/duplicate`,
  );
  return { diagram: data, etag: parseEtag(headers) };
}
