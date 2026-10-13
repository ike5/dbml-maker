import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createParseScheduler } from "./parse.js";
import { createEditorStore } from "./store.js";

const load = (source = "Table a {}") => ({
  diagramId: "d1",
  role: "owner",
  name: "Shop",
  source,
  layout: null,
  etag: 1,
});

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};

describe("parse scheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("parses at once at the start", () => {
    const parse = vi.fn(() => Promise.resolve({ result: {}, errors: [] }));
    const store = createEditorStore(load());
    createParseScheduler({ store, parse }).start();
    expect(parse).toHaveBeenCalledWith("Table a {}");
  });

  it("parses 250 ms after the last change", () => {
    const parse = vi.fn(() => Promise.resolve({ result: {}, errors: [] }));
    const store = createEditorStore(load());
    createParseScheduler({ store, parse }).start();
    parse.mockClear();
    store.getState().setSource("a");
    vi.advanceTimersByTime(200);
    store.getState().setSource("ab");
    vi.advanceTimersByTime(249);
    expect(parse).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledWith("ab");
  });

  it("ignores an answer that is older than the newest request", async () => {
    const first = deferred();
    const second = deferred();
    const parse = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const store = createEditorStore(load());
    createParseScheduler({ store, parse }).start();
    store.getState().setSource("b");
    vi.advanceTimersByTime(250);
    second.resolve({ result: { n: 2 }, errors: [] });
    await vi.advanceTimersByTimeAsync(0);
    first.resolve({ result: { n: 1 }, errors: [] });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().parseResult).toEqual({ n: 2 });
  });

  it("parses at once after a load", () => {
    const parse = vi.fn(() => Promise.resolve({ result: {}, errors: [] }));
    const store = createEditorStore(load());
    createParseScheduler({ store, parse }).start();
    parse.mockClear();
    store.getState().load({ ...load("Table z {}"), etag: 2 });
    expect(parse).toHaveBeenCalledWith("Table z {}");
  });

  it("shows a failure of the worker as an error", async () => {
    const parse = vi.fn(() => Promise.reject(new Error("crash")));
    const store = createEditorStore(load());
    createParseScheduler({ store, parse }).start();
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().parseErrors).toHaveLength(1);
  });

  it("does not parse after stop", () => {
    const parse = vi.fn(() => Promise.resolve({ result: {}, errors: [] }));
    const store = createEditorStore(load());
    const scheduler = createParseScheduler({ store, parse });
    scheduler.start();
    parse.mockClear();
    store.getState().setSource("x");
    scheduler.stop();
    vi.advanceTimersByTime(1000);
    expect(parse).not.toHaveBeenCalled();
  });
});
