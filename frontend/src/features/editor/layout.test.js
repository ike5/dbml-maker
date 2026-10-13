import { describe, expect, it } from "vitest";
import { layoutsEqual, normalizeLayout } from "./layout.js";

describe("normalizeLayout", () => {
  it("gives an empty layout for a missing layout", () => {
    expect(normalizeLayout(null)).toEqual({ format: 1, tables: {} });
    expect(normalizeLayout(undefined)).toEqual({ format: 1, tables: {} });
    expect(normalizeLayout({})).toEqual({ format: 1, tables: {} });
  });

  it("keeps only the entries with finite x and y", () => {
    const layout = normalizeLayout({
      format: 1,
      tables: {
        a: { x: 1, y: 2 },
        b: { x: "1", y: 2 },
        c: { x: Infinity, y: 0 },
        d: null,
        e: { x: 0, y: -4.5, extra: true },
      },
    });
    expect(layout).toEqual({ format: 1, tables: { a: { x: 1, y: 2 }, e: { x: 0, y: -4.5 } } });
  });

  it("accepts tables without a format", () => {
    expect(normalizeLayout({ tables: { a: { x: 1, y: 1 } } }).tables).toEqual({
      a: { x: 1, y: 1 },
    });
  });

  it("ignores a tables value that is not an object", () => {
    expect(normalizeLayout({ format: 1, tables: 5 })).toEqual({ format: 1, tables: {} });
  });
});

describe("layoutsEqual", () => {
  const a = { format: 1, tables: { t: { x: 1, y: 2 } } };
  it("compares the positions", () => {
    expect(layoutsEqual(a, { format: 1, tables: { t: { x: 1, y: 2 } } })).toBe(true);
    expect(layoutsEqual(a, { format: 1, tables: { t: { x: 1, y: 3 } } })).toBe(false);
    expect(layoutsEqual(a, { format: 1, tables: {} })).toBe(false);
    expect(layoutsEqual(a, { format: 1, tables: { u: { x: 1, y: 2 } } })).toBe(false);
  });
});
