// The store of the open diagram (DESIGN.md §12.2). The page makes one store for each open
// diagram, so a test can make a store alone and the state never leaks between diagrams.
import { createContext, useContext } from "react";
import { createStore, useStore } from "zustand";
import { layoutsEqual, normalizeLayout } from "./layout.js";

/** @typedef {"saved" | "dirty" | "saving" | "error" | "conflict"} SaveState */

/** One shared array, so that "no errors" keeps its identity (the code pane needs this). */
const NO_ERRORS = Object.freeze([]);

const content = (data) => ({
  name: data.name,
  source: data.source,
  layout: normalizeLayout(data.layout),
});

/**
 * Give the fields that are different from the last saved values.
 * @param {{ name: string, source: string, layout: any, saved: any }} state
 * @returns {{ name?: string, source?: string, layout?: any }}
 */
export function changedFields(state) {
  const changes = {};
  if (state.name !== state.saved.name) changes.name = state.name;
  if (state.source !== state.saved.source) changes.source = state.source;
  if (!layoutsEqual(state.layout, state.saved.layout)) changes.layout = state.layout;
  return changes;
}

const sameErrors = (a, b) =>
  a.length === b.length &&
  a.every(
    (error, index) =>
      error.message === b[index].message &&
      error.line === b[index].line &&
      error.column === b[index].column &&
      error.endLine === b[index].endLine &&
      error.endColumn === b[index].endColumn,
  );

/**
 * @param {object} [initial] The data for `load`. Without it, the store is empty.
 * @returns A Zustand store.
 */
export function createEditorStore(initial) {
  const store = createStore((set, get) => {
    // A change of the content makes the state "dirty" if there are changes to save.
    // The states "saving" and "conflict" stay as they are.
    const afterChange = (patch) => {
      const next = { ...get(), ...patch };
      let { saveState } = next;
      if (next.readOnly) saveState = "saved";
      else if (saveState === "saved" || saveState === "dirty" || saveState === "error") {
        saveState = Object.keys(changedFields(next)).length > 0 ? "dirty" : "saved";
      }
      set({ ...patch, saveState });
    };

    return {
      diagramId: null,
      role: "viewer",
      readOnly: true,
      name: "",
      source: "",
      layout: normalizeLayout(null),
      etag: 0,
      saved: { name: "", source: "", layout: normalizeLayout(null) },
      parseResult: null,
      parseErrors: NO_ERRORS,
      saveState: /** @type {SaveState} */ ("saved"),
      conflict: null,
      // A new number at each load. A save or a parse that started before the load is old.
      generation: 0,

      /**
       * Replace the whole diagram: at the first load, after a restore, and after "Load the new version".
       * @param {{ diagramId: string, role: string, readOnly?: boolean, etag: number,
       *   name: string, source: string, layout: unknown }} data
       */
      load(data) {
        const fields = content(data);
        set({
          diagramId: data.diagramId,
          role: data.role,
          readOnly: data.readOnly ?? data.role === "viewer",
          ...fields,
          etag: data.etag,
          saved: { ...fields },
          saveState: "saved",
          conflict: null,
          generation: get().generation + 1,
        });
      },
      setName(name) {
        if (name !== get().name) afterChange({ name });
      },
      setSource(source) {
        if (source !== get().source) afterChange({ source });
      },
      setLayout(layout) {
        afterChange({ layout });
      },
      /**
       * @param {{ result: any, errors: any[] }} parsed A parse answer.
       */
      setParse({ result, errors }) {
        const state = get();
        const patch = {};
        if (errors.length === 0) {
          patch.parseResult = result;
          patch.parseErrors = NO_ERRORS;
        } else if (!sameErrors(errors, state.parseErrors)) {
          // EDT-002: the canvas keeps the last correct parse result.
          patch.parseErrors = errors;
        }
        if (Object.keys(patch).length > 0) set(patch);
      },
      setSaveState(saveState) {
        set({ saveState });
      },
      /** The values that a save sent are now the saved values. */
      applySaved(sent, etag) {
        set({ saved: { ...get().saved, ...sent }, etag });
      },
      setConflict(current) {
        set({ saveState: "conflict", conflict: current ?? {} });
      },
      /** After a conflict: use the new change number and save the local content. */
      resolveConflict(etag) {
        set({ etag, conflict: null, saveState: "dirty" });
      },
    };
  });
  if (initial) store.getState().load(initial);
  return store;
}

export const EditorStoreContext = createContext(null);

/**
 * @param {(state: any) => any} selector
 */
export function useEditorStore(selector) {
  const store = useContext(EditorStoreContext);
  return useStore(store, selector);
}

/** @returns The store object itself, for code that reads the state at an event. */
export function useEditorStoreApi() {
  return useContext(EditorStoreContext);
}
