// One function for each diagram endpoint (DESIGN.md §7.11).
import { apiRequest } from "./client.js";

/**
 * @typedef {{ id: string, email: string, display_name: string }} UserSummary
 * @typedef {"owner" | "editor" | "viewer"} DiagramRole
 * @typedef {{ format: number, tables: Record<string, { x: number, y: number }> }} Layout
 * @typedef {{
 *   id: string, name: string, role: DiagramRole, change_number: number,
 *   updated_at: string, updated_by: UserSummary | null, trashed_at: string | null,
 * }} DiagramSummary
 * @typedef {DiagramSummary & {
 *   workspace_id: string, source: string, layout: Layout, created_at: string,
 * }} Diagram
 * @typedef {{
 *   id: string, kind: "auto" | "named" | "restore", label: string,
 *   change_number: number, created_at: string, created_by: UserSummary | null,
 * }} VersionSummary
 * @typedef {VersionSummary & { source: string, layout: Layout }} Version
 * @typedef {{ id: string, email: string, role: "viewer" | "editor", created_at: string }} Share
 * @typedef {{
 *   enabled: boolean, token: string | null, url: string | null, created_at: string | null,
 * }} PublicLink
 * @typedef {{ results: any[], next: string | null }} Page
 * @typedef {{ diagram: Diagram, etag: number }} DiagramResult
 */

const base = (id) => `/api/v1/diagrams/${encodeURIComponent(id)}`;

/**
 * Read the change number from the ETag header: `"5"` gives 5.
 * @param {Headers} headers
 * @returns {number}
 */
export function parseEtag(headers) {
  const value = headers.get("ETag") ?? "";
  return Number.parseInt(value.replace(/^W\//, "").replaceAll('"', ""), 10);
}

function toResult({ data, headers }) {
  return { diagram: data, etag: parseEtag(headers) };
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/**
 * @param {{ scope?: "mine" | "shared" | "trash", cursor?: string | null, pageSize?: number }} [options]
 * @returns {Promise<Page>} A page of DiagramSummary.
 */
export async function listDiagrams({ scope = "mine", cursor, pageSize } = {}) {
  const { data } = await apiRequest(
    "GET",
    `/api/v1/diagrams${query({ scope, cursor, page_size: pageSize })}`,
  );
  return data;
}

/**
 * @param {{ name: string, source?: string, layout?: Layout }} input
 * @returns {Promise<DiagramResult>}
 */
export async function createDiagram({ name, source, layout }) {
  return toResult(await apiRequest("POST", "/api/v1/diagrams", { body: { name, source, layout } }));
}

/** @returns {Promise<DiagramResult>} */
export async function getDiagram(id) {
  return toResult(await apiRequest("GET", base(id)));
}

/**
 * Save changes. The server returns 412 if etag is old (DGM-002).
 * @param {string} id
 * @param {{ name?: string, source?: string, layout?: Layout }} changes
 * @param {{ etag: number, keepalive?: boolean }} options
 * @returns {Promise<DiagramResult>}
 */
export async function updateDiagram(id, changes, { etag, keepalive = false }) {
  return toResult(
    await apiRequest("PATCH", base(id), {
      body: changes,
      headers: { "If-Match": `"${etag}"` },
      keepalive,
    }),
  );
}

/** Move a diagram to the trash. */
export async function trashDiagram(id) {
  await apiRequest("DELETE", base(id));
}

/** @returns {Promise<DiagramResult>} */
export async function restoreDiagram(id) {
  return toResult(await apiRequest("POST", `${base(id)}/restore`));
}

export async function deleteDiagramPermanently(id) {
  await apiRequest("DELETE", `${base(id)}/permanent`);
}

/** @returns {Promise<DiagramResult>} */
export async function duplicateDiagram(id) {
  return toResult(await apiRequest("POST", `${base(id)}/duplicate`));
}

/**
 * @param {string} id
 * @param {{ cursor?: string | null }} [options]
 * @returns {Promise<Page>} A page of VersionSummary.
 */
export async function listVersions(id, { cursor } = {}) {
  const { data } = await apiRequest("GET", `${base(id)}/versions${query({ cursor })}`);
  return data;
}

/** @returns {Promise<VersionSummary>} */
export async function createVersion(id, { label }) {
  const { data } = await apiRequest("POST", `${base(id)}/versions`, { body: { label } });
  return data;
}

/** @returns {Promise<Version>} */
export async function getVersion(id, versionId) {
  const { data } = await apiRequest("GET", `${base(id)}/versions/${encodeURIComponent(versionId)}`);
  return data;
}

/**
 * @param {string} id
 * @param {string} versionId
 * @param {{ etag: number }} options
 * @returns {Promise<DiagramResult>}
 */
export async function restoreVersion(id, versionId, { etag }) {
  return toResult(
    await apiRequest("POST", `${base(id)}/versions/${encodeURIComponent(versionId)}/restore`, {
      headers: { "If-Match": `"${etag}"` },
    }),
  );
}

/** @returns {Promise<Share[]>} */
export async function listShares(id) {
  const { data } = await apiRequest("GET", `${base(id)}/shares`);
  return data.results;
}

/** @returns {Promise<Share>} */
export async function createShare(id, { email, role }) {
  const { data } = await apiRequest("POST", `${base(id)}/shares`, { body: { email, role } });
  return data;
}

/** @returns {Promise<Share>} */
export async function updateShare(id, shareId, { role }) {
  const { data } = await apiRequest("PATCH", `${base(id)}/shares/${encodeURIComponent(shareId)}`, {
    body: { role },
  });
  return data;
}

export async function deleteShare(id, shareId) {
  await apiRequest("DELETE", `${base(id)}/shares/${encodeURIComponent(shareId)}`);
}

/** @returns {Promise<PublicLink>} */
export async function getPublicLink(id) {
  const { data } = await apiRequest("GET", `${base(id)}/public-link`);
  return data;
}

/** @returns {Promise<PublicLink>} */
export async function enablePublicLink(id) {
  const { data } = await apiRequest("PUT", `${base(id)}/public-link`);
  return data;
}

/** @returns {Promise<PublicLink>} */
export async function rotatePublicLink(id) {
  const { data } = await apiRequest("POST", `${base(id)}/public-link/rotate`);
  return data;
}

export async function disablePublicLink(id) {
  await apiRequest("DELETE", `${base(id)}/public-link`);
}
