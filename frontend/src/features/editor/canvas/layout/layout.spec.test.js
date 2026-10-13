import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import { makeParseResult } from "../fixtures.js";
import { arrangeAll, placeMissing } from "./layout.js";
import { estimateSize } from "./size.js";

const elk = new ELK();

describe("layout", () => {
  it("EDT-004 gives a position to a table without a position, and the other tables do not move", async () => {
    const parseResult = makeParseResult();
    const positions = {
      "public.users": { x: 100, y: 50 },
      "public.orders": { x: 500, y: 300 },
    };
    const placed = await placeMissing({ parseResult, positions, elk });
    expect(Object.keys(placed)).toEqual(["public.items"]);
    const right = Math.max(
      100 + estimateSize(parseResult.tables[0]).width,
      500 + estimateSize(parseResult.tables[1]).width,
    );
    expect(placed["public.items"].x).toBe(right + 80);
    expect(placed["public.items"].y).toBe(50);
    // The input positions are not changed.
    expect(positions["public.users"]).toEqual({ x: 100, y: 50 });
  });

  it("EDT-004 gives a full layout at the origin when no table has a position", async () => {
    const parseResult = makeParseResult();
    const placed = await placeMissing({ parseResult, positions: {}, elk });
    expect(Object.keys(placed).sort()).toEqual(parseResult.tables.map((t) => t.key).sort());
    expect(Math.min(...Object.values(placed).map((p) => p.x))).toBe(0);
    expect(Math.min(...Object.values(placed).map((p) => p.y))).toBe(0);
  });

  it("gives no position when every table has one", async () => {
    const parseResult = makeParseResult();
    const positions = Object.fromEntries(parseResult.tables.map((t) => [t.key, { x: 0, y: 0 }]));
    expect(await placeMissing({ parseResult, positions, elk })).toEqual({});
  });

  it("arrangeAll gives a position to all tables, with no overlap", async () => {
    const parseResult = makeParseResult();
    const arranged = await arrangeAll({ parseResult, elk });
    expect(Object.keys(arranged)).toHaveLength(3);
    const boxes = parseResult.tables.map((table) => ({
      ...arranged[table.key],
      ...estimateSize(table),
    }));
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it("estimateSize gives a size from the columns", () => {
    const { width, height } = estimateSize(makeParseResult().tables[0]);
    expect(width).toBeGreaterThanOrEqual(180);
    expect(height).toBe(32 + 2 * 24 + 4 + 2);
  });
});
