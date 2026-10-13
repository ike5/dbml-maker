import { describe, expect, it } from "vitest";
import { changedFields, createEditorStore } from "./store.js";

const data = (overrides = {}) => ({
  diagramId: "d1",
  role: "owner",
  name: "Shop",
  source: "Table a {}",
  layout: { format: 1, tables: {} },
  etag: 3,
  ...overrides,
});

describe("editor store", () => {
  it("loads a diagram and starts in the state saved", () => {
    const store = createEditorStore(data());
    const state = store.getState();
    expect(state).toMatchObject({ name: "Shop", etag: 3, saveState: "saved", readOnly: false });
    expect(changedFields(state)).toEqual({});
  });

  it("normalizes the layout at load", () => {
    const store = createEditorStore(data({ layout: null }));
    expect(store.getState().layout).toEqual({ format: 1, tables: {} });
  });

  it("is read only for a viewer", () => {
    const store = createEditorStore(data({ role: "viewer" }));
    expect(store.getState().readOnly).toBe(true);
    store.getState().setSource("x");
    expect(store.getState().saveState).toBe("saved");
  });

  it("goes to dirty at a change and back to saved when the change is undone", () => {
    const store = createEditorStore(data());
    store.getState().setSource("Table b {}");
    expect(store.getState().saveState).toBe("dirty");
    expect(changedFields(store.getState())).toEqual({ source: "Table b {}" });
    store.getState().setSource("Table a {}");
    expect(store.getState().saveState).toBe("saved");
  });

  it("does not change the state saving or conflict at a change", () => {
    const store = createEditorStore(data());
    store.getState().setSaveState("saving");
    store.getState().setName("New");
    expect(store.getState().saveState).toBe("saving");
    store.getState().setConflict({ change_number: 9 });
    store.getState().setName("Newer");
    expect(store.getState().saveState).toBe("conflict");
  });

  it("applySaved updates the saved values and the change number", () => {
    const store = createEditorStore(data());
    store.getState().setName("New");
    store.getState().applySaved({ name: "New" }, 4);
    expect(store.getState().etag).toBe(4);
    expect(changedFields(store.getState())).toEqual({});
  });

  it("keeps the last correct parse result when the source has errors", () => {
    const store = createEditorStore(data());
    const result = { tables: [] };
    store.getState().setParse({ result, errors: [] });
    const error = { message: "bad", line: 1, column: 1, endLine: 1, endColumn: 2 };
    store.getState().setParse({ result: null, errors: [error] });
    expect(store.getState().parseResult).toBe(result);
    expect(store.getState().parseErrors).toEqual([error]);
    store.getState().setParse({ result: { tables: [1] }, errors: [] });
    expect(store.getState().parseErrors).toEqual([]);
  });

  it("keeps the identity of the errors when they do not change", () => {
    const store = createEditorStore(data());
    const error = { message: "bad", line: 1, column: 1, endLine: 1, endColumn: 2 };
    store.getState().setParse({ result: null, errors: [error] });
    const first = store.getState().parseErrors;
    store.getState().setParse({ result: null, errors: [{ ...error }] });
    expect(store.getState().parseErrors).toBe(first);
  });

  it("resolveConflict sets the change number and the state dirty", () => {
    const store = createEditorStore(data());
    store.getState().setConflict({});
    store.getState().resolveConflict(8);
    expect(store.getState()).toMatchObject({ etag: 8, saveState: "dirty", conflict: null });
  });
});
