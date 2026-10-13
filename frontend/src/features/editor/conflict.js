// The two ways to end a conflict after a 412 (DGM-002, DESIGN.md §12.6).
import { fromDiagram } from "./session.js";

/**
 * "Load the new version": drop the local changes and read the diagram again.
 * @param {object} options
 * @param {ReturnType<typeof import("./store.js").createEditorStore>} options.store
 * @param {(id: string) => Promise<{ diagram: any, etag: number }>} options.getDiagram
 */
export async function loadNewVersion({ store, getDiagram }) {
  const { diagram, etag } = await getDiagram(store.getState().diagramId);
  store.getState().load(fromDiagram(diagram, etag));
}

/**
 * "Keep my version": copy the server content to a version, read the new change number, and
 * save the local content. The copy means that no content is lost.
 * @param {object} options
 * @param {ReturnType<typeof import("./store.js").createEditorStore>} options.store
 * @param {{ flush: () => Promise<void> }} options.autosave
 * @param {(id: string, input: { label: string }) => Promise<unknown>} options.createVersion
 * @param {(id: string) => Promise<{ diagram: any, etag: number }>} options.getDiagram
 * @param {string} options.label
 */
export async function keepMyVersion({ store, autosave, createVersion, getDiagram, label }) {
  const id = store.getState().diagramId;
  await createVersion(id, { label });
  const { etag } = await getDiagram(id);
  store.getState().resolveConflict(etag);
  await autosave.flush();
}
