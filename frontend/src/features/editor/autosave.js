// Autosave (EDT-003, DGM-002, DESIGN.md §7.3, §12.6).
import { changedFields } from "./store.js";

export const AUTOSAVE_DELAY_MS = 1000;
// The browser limit of a keepalive request is 64 KiB. Stay below it.
export const KEEPALIVE_LIMIT_BYTES = 60 * 1024;

const byteLength = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

/**
 * Save the changes of the store 1 second after the last change.
 * @param {object} options
 * @param {ReturnType<typeof import("./store.js").createEditorStore>} options.store
 * @param {(id: string, changes: object, options: { etag: number, keepalive: boolean }) => Promise<{ etag: number }>} options.save
 *   The API function `updateDiagram`.
 * @param {() => void} [options.onNameSaved] Runs after a save that changed the name.
 * @param {number} [options.delay]
 * @returns {{ start: () => void, stop: () => void, flush: (options?: { keepalive?: boolean }) => Promise<void>, cancel: () => void }}
 */
export function createAutosave({ store, save, onNameSaved, delay = AUTOSAVE_DELAY_MS }) {
  let timer = null;
  let inFlight = false;
  // A save request that came during a save. It runs when the save ends.
  let rerun = null;
  let unsubscribe = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  function cancel() {
    clearTimer();
    rerun = null;
  }

  function schedule() {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, delay);
  }

  async function flush({ keepalive = false } = {}) {
    clearTimer();
    const state = store.getState();
    // A viewer never saves, and a conflict stops all saves until the user decides.
    if (state.readOnly || state.saveState === "conflict") return;
    if (inFlight) {
      rerun = { keepalive: keepalive || Boolean(rerun?.keepalive) };
      return;
    }
    const changes = changedFields(state);
    if (Object.keys(changes).length === 0) {
      if (state.saveState !== "saved") state.setSaveState("saved");
      return;
    }

    inFlight = true;
    state.setSaveState("saving");
    const { generation, diagramId, etag } = state;
    const useKeepalive = keepalive && byteLength(changes) <= KEEPALIVE_LIMIT_BYTES;
    try {
      const result = await save(diagramId, changes, { etag, keepalive: useKeepalive });
      // The user loaded a different content during the save. The result is old.
      if (store.getState().generation !== generation) return;
      store.getState().applySaved(changes, result.etag);
      if ("name" in changes) onNameSaved?.();
      const stillChanged = Object.keys(changedFields(store.getState())).length > 0;
      store.getState().setSaveState(stillChanged ? "dirty" : "saved");
      if (stillChanged && !rerun && timer === null) schedule();
    } catch (error) {
      if (store.getState().generation !== generation) return;
      if (error?.status === 412) {
        cancel();
        store.getState().setConflict(error.body?.error?.current);
      } else {
        store.getState().setSaveState("error");
      }
    } finally {
      inFlight = false;
      const next = rerun;
      rerun = null;
      if (next && store.getState().generation === generation) flush(next);
    }
  }

  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush({ keepalive: true });
  };

  // The browser shows its own warning text. The page cannot change it.
  const onBeforeUnload = (event) => {
    const state = store.getState();
    if (!state.readOnly && state.saveState !== "saved") {
      event.preventDefault();
      event.returnValue = "";
    }
  };

  return {
    start() {
      if (unsubscribe) return;
      unsubscribe = store.subscribe((state, previous) => {
        if (state.generation !== previous.generation) {
          cancel();
          return;
        }
        if (state.readOnly || state.saveState === "conflict") return;
        if (
          state.name !== previous.name ||
          state.source !== previous.source ||
          state.layout !== previous.layout
        ) {
          schedule();
        }
      });
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("beforeunload", onBeforeUnload);
    },
    stop() {
      // The user can leave the page less than 1 second after a change. Save at once (EDT-003).
      // The save in progress still applies its result. A flush with no changes does nothing.
      flush({ keepalive: true });
      unsubscribe?.();
      unsubscribe = null;
      cancel();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    },
    flush,
    cancel,
  };
}
