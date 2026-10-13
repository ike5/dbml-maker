import { describe, expect, it } from "vitest";
import { GROUP_LABEL_HEIGHT, GROUP_PADDING } from "./constants.js";
import { contrastText, isHexColor } from "./colors.js";
import { makeParseResult } from "./fixtures.js";
import { markPath } from "./marks.js";
import { estimateSize } from "./layout/size.js";
import { handleId, toLayout, toNodesAndEdges } from "./toFlow.js";

const sizes = {
  "public.users": { width: 200, height: 100 },
  "public.orders": { width: 200, height: 100 },
  "public.items": { width: 200, height: 100 },
};

describe("toNodesAndEdges", () => {
  const positions = {
    "public.users": { x: 0, y: 0 },
    "public.orders": { x: 400, y: 0 },
    "public.items": { x: 100, y: 300 },
  };

  it("makes one node for each table, with its position", () => {
    const { nodes } = toNodesAndEdges(makeParseResult(), positions, sizes);
    const tables = nodes.filter((node) => node.type === "table");
    expect(tables.map((node) => node.id)).toEqual([
      "public.users",
      "public.orders",
      "public.items",
    ]);
    expect(tables[1].position).toEqual({ x: 400, y: 0 });
    expect(tables[0].measured).toEqual(sizes["public.users"]);
  });

  it("uses a right handle and a left handle, and the IDs match the columns", () => {
    const { edges } = toNodesAndEdges(makeParseResult(), positions, sizes);
    // orders is to the right of users, so the edge leaves orders on the left.
    const first = edges.find((edge) => edge.source === "public.orders");
    expect(first.sourceHandle).toBe(handleId("user_id", "left"));
    expect(first.targetHandle).toBe(handleId("id", "right"));
  });

  it("chooses the other sides when the target is to the right", () => {
    const { edges } = toNodesAndEdges(
      makeParseResult(),
      { ...positions, "public.users": { x: 900, y: 0 } },
      sizes,
    );
    const first = edges.find((edge) => edge.source === "public.orders");
    expect(first.sourceHandle).toBe(handleId("user_id", "right"));
    expect(first.targetHandle).toBe(handleId("id", "left"));
  });

  it("puts the cardinality in the edge data", () => {
    const { edges } = toNodesAndEdges(makeParseResult(), positions, sizes);
    expect(edges[0].data).toMatchObject({ cardinality: "n-1", fromEnd: "many", toEnd: "one" });
  });

  it("computes the bounds of a group from its tables, with padding", () => {
    const { nodes } = toNodesAndEdges(makeParseResult(), positions, sizes);
    const group = nodes[0];
    expect(group.type).toBe("tableGroup");
    expect(group.selectable).toBe(false);
    expect(group.draggable).toBe(false);
    expect(group.position).toEqual({
      x: 100 - GROUP_PADDING,
      y: 0 - GROUP_PADDING - GROUP_LABEL_HEIGHT,
    });
    expect(group.width).toBe(600 - 100 + 2 * GROUP_PADDING);
    expect(group.height).toBe(400 + 2 * GROUP_PADDING + GROUP_LABEL_HEIGHT);
  });

  it("computes the group again when a table moves", () => {
    const moved = { ...positions, "public.items": { x: 100, y: 1000 } };
    const { nodes } = toNodesAndEdges(makeParseResult(), moved, sizes);
    expect(nodes[0].height).toBe(1100 + 2 * GROUP_PADDING + GROUP_LABEL_HEIGHT);
  });

  it("makes no node and no edge for a table without a position", () => {
    const { nodes, edges } = toNodesAndEdges(
      makeParseResult(),
      { "public.users": { x: 0, y: 0 } },
      sizes,
    );
    expect(nodes.map((node) => node.id)).toEqual(["public.users"]);
    expect(edges).toEqual([]);
  });

  it("estimates the size when no measured size exists", () => {
    const { nodes } = toNodesAndEdges(makeParseResult(), positions);
    expect(nodes[0].width).toBeGreaterThan(0);
  });
});

describe("toLayout", () => {
  it("gives the full layout of the tables that have a position", () => {
    expect(
      toLayout(makeParseResult(), { "public.users": { x: 1, y: 2 }, "other.x": { x: 0, y: 0 } }),
    ).toEqual({
      format: 1,
      tables: { "public.users": { x: 1, y: 2 } },
    });
  });
});

describe("helpers", () => {
  it("accepts only hex colors", () => {
    expect(isHexColor("#fff")).toBe(true);
    expect(isHexColor("#a1b2c3")).toBe(true);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("#12")).toBe(false);
    expect(isHexColor("#fff; background: url(x)")).toBe(false);
  });

  it("gives a dark text on a light color and a light text on a dark color", () => {
    expect(contrastText("#ffffff")).toBe("#1c2230");
    expect(contrastText("#000")).toBe("#ffffff");
  });

  it("makes a different mark for one and many", () => {
    expect(markPath(0, 0, "right", "one")).not.toBe(markPath(0, 0, "right", "many"));
  });

  it("estimates a wider and taller node for more and longer columns", () => {
    const small = estimateSize({ name: "a", columns: [{ name: "id", type: "int" }] });
    const large = estimateSize({
      name: "a",
      columns: [
        { name: "id", type: "int" },
        { name: "a_very_long_column_name_here", type: "character varying(255)" },
      ],
    });
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.height).toBeGreaterThan(small.height);
  });
});
