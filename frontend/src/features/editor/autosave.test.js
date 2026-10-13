import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosave, KEEPALIVE_LIMIT_BYTES } from "./autosave.js";
import { createEditorStore } from "./store.js";

const load = (overrides = {}) => ({
  diagramId: "d1",
  role: "owner",
  name: "Shop",
  source: "Table a {}",
  layout: { format: 1, tables: {} },
  etag: 3,
  ...overrides,
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

function setup(overrides) {
  const store = createEditorStore(load(overrides));
  const save = vi.fn(async (_id, _changes, { etag }) => ({ etag: etag + 1 }));
  const onNameSaved = vi.fn();
  const autosave = createAutosave({ store, save, onNameSaved });
  autosave.start();
  return { store, save, onNameSaved, autosave };
}

const setHidden = (hidden) => {
  Object.defineProperty(document, "visibilityState", {
    value: hidden ? "hidden" : "visible",
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

const conflictError = (current) =>
  Object.assign(new Error("x"), { status: 412, body: { error: { current } } });

describe("autosave", () => {
  let autosaves;
  beforeEach(() => {
    vi.useFakeTimers();
    autosaves = [];
  });
  afterEach(() => {
    autosaves.forEach((autosave) => autosave.stop());
    vi.useRealTimers();
    setHidden(false);
  });

  const make = (overrides) => {
    const result = setup(overrides);
    autosaves.push(result.autosave);
    return result;
  };

  it("EDT-003: stop saves a change that is not saved yet, one time", async () => {
    const { store, save, autosave } = make();
    store.getState().setSource("changed");
    await vi.advanceTimersByTimeAsync(300);
    autosave.stop();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toEqual({ source: "changed" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.getState().saveState).toBe("saved");
    autosave.stop();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves 1 second after the last change", async () => {
    const { store, save } = make();
    store.getState().setSource("a");
    await vi.advanceTimersByTimeAsync(900);
    store.getState().setSource("ab");
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(store.getState().saveState).toBe("saved");
    expect(store.getState().etag).toBe(4);
  });

  it("sends only the changed fields with the change number", async () => {
    const { store, save } = make();
    store.getState().setName("New");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledWith("d1", { name: "New" }, { etag: 3, keepalive: false });
  });

  it("calls onNameSaved only if the name changed", async () => {
    const { store, onNameSaved } = make();
    store.getState().setSource("x");
    await vi.advanceTimersByTimeAsync(1000);
    expect(onNameSaved).not.toHaveBeenCalled();
    store.getState().setName("New");
    await vi.advanceTimersByTimeAsync(1000);
    expect(onNameSaved).toHaveBeenCalledTimes(1);
  });

  it("makes only one save at a time and sends the later changes in a second save", async () => {
    const { store, save } = make();
    const first = deferred();
    save.mockImplementationOnce(() => first.promise);
    store.getState().setSource("one");
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState().saveState).toBe("saving");
    store.getState().setSource("two");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve({ etag: 4 });
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("d1", { source: "two" }, { etag: 4, keepalive: false });
  });

  it("schedules the next save if changes occur during a save", async () => {
    const { store, save } = make();
    const first = deferred();
    save.mockImplementationOnce(() => first.promise);
    store.getState().setSource("one");
    await vi.advanceTimersByTimeAsync(1000);
    store.getState().setSource("two");
    first.resolve({ etag: 4 });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().saveState).toBe("dirty");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("saves at once with keepalive when the page becomes hidden", async () => {
    const { store, save } = make();
    store.getState().setSource("x");
    setHidden(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledWith("d1", { source: "x" }, { etag: 3, keepalive: true });
  });

  it("does not use keepalive for a body that is larger than 60 KB", async () => {
    const { store, save } = make();
    store.getState().setSource("x".repeat(KEEPALIVE_LIMIT_BYTES + 1));
    setHidden(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(save.mock.calls[0][2].keepalive).toBe(false);
  });

  it("asks the browser to warn the user if changes are not saved", () => {
    const { store } = make();
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    store.getState().setSource("x");
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("a 412 stops the autosave and sets the state conflict with the current data", async () => {
    const { store, save } = make();
    const current = { change_number: 9, updated_by: null, updated_at: "2026-01-01T00:00:00Z" };
    save.mockRejectedValueOnce(conflictError(current));
    store.getState().setSource("x");
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState().saveState).toBe("conflict");
    expect(store.getState().conflict).toEqual(current);
    store.getState().setSource("xy");
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("sets the state error for another error and saves again at the next change", async () => {
    const { store, save } = make();
    save.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500 }));
    store.getState().setSource("x");
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState().saveState).toBe("error");
    store.getState().setSource("xy");
    expect(store.getState().saveState).toBe("dirty");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(store.getState().saveState).toBe("saved");
  });

  it("flush saves again after an error", async () => {
    const { store, save, autosave } = make();
    save.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 500 }));
    store.getState().setSource("x");
    await vi.advanceTimersByTimeAsync(1000);
    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("never saves for a viewer", async () => {
    const { store, save } = make({ role: "viewer" });
    store.getState().setSource("x");
    store.getState().setLayout({ format: 1, tables: { a: { x: 1, y: 1 } } });
    await vi.advanceTimersByTimeAsync(5000);
    setHidden(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).not.toHaveBeenCalled();
  });

  it("drops a pending save when a diagram is loaded", async () => {
    const { store, save } = make();
    store.getState().setSource("x");
    store.getState().load(load({ etag: 7 }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it("ignores the result of a save that was in progress at a load", async () => {
    const { store, save } = make();
    const first = deferred();
    save.mockImplementationOnce(() => first.promise);
    store.getState().setSource("x");
    await vi.advanceTimersByTimeAsync(1000);
    store.getState().load(load({ etag: 7, source: "loaded" }));
    first.resolve({ etag: 4 });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().etag).toBe(7);
    expect(store.getState().saved.source).toBe("loaded");
  });
});
