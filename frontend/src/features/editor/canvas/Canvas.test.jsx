import ELK from "elkjs/lib/elk.bundled.js";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { makeParseResult } from "./fixtures.js";

// A Web Worker does not exist in jsdom, so the test uses the elk build without a worker.
vi.mock("./layout/elk.js", () => ({ getElk: () => new ELK() }));

const { Canvas } = await import("./Canvas.jsx");

beforeAll(() => {
  // jsdom does not have these browser APIs. React Flow needs them.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.DOMMatrixReadOnly ??= class {
    constructor() {
      this.m22 = 1;
    }
  };
});

describe("Canvas", () => {
  it("calls onLayoutChange one time after the automatic position, with all tables", async () => {
    const onLayoutChange = vi.fn();
    render(
      <div style={{ width: 800, height: 600 }}>
        <Canvas
          parseResult={makeParseResult()}
          layout={{ format: 1, tables: {} }}
          onLayoutChange={onLayoutChange}
          readOnly={false}
          viewportKey={null}
        />
      </div>,
    );
    await waitFor(() => expect(onLayoutChange).toHaveBeenCalledTimes(1));
    const layout = onLayoutChange.mock.calls[0][0];
    expect(layout.format).toBe(1);
    expect(Object.keys(layout.tables).sort()).toEqual([
      "public.items",
      "public.orders",
      "public.users",
    ]);
    expect(await screen.findByText("users")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onLayoutChange).toHaveBeenCalledTimes(1);
  });

  it("does not call onLayoutChange when all tables have a position", async () => {
    const onLayoutChange = vi.fn();
    const parseResult = makeParseResult();
    const tables = Object.fromEntries(
      parseResult.tables.map((t, i) => [t.key, { x: i * 300, y: 0 }]),
    );
    render(
      <div style={{ width: 800, height: 600 }}>
        <Canvas
          parseResult={parseResult}
          layout={{ format: 1, tables }}
          onLayoutChange={onLayoutChange}
          viewportKey={null}
        />
      </div>,
    );
    expect(await screen.findByText("orders")).toBeInTheDocument();
    expect(onLayoutChange).not.toHaveBeenCalled();
  });

  it("makes the nodes draggable, and in readOnly it does not", async () => {
    const parseResult = makeParseResult();
    const tables = Object.fromEntries(
      parseResult.tables.map((t, i) => [t.key, { x: i * 300, y: 0 }]),
    );
    const layout = { format: 1, tables };
    const view = (readOnly) => (
      <div style={{ width: 800, height: 600 }}>
        <Canvas parseResult={parseResult} layout={layout} readOnly={readOnly} viewportKey={null} />
      </div>
    );
    const editable = render(view(false));
    await screen.findByText("users");
    expect(editable.container.querySelector(".react-flow__node-table.draggable")).not.toBeNull();
    editable.unmount();

    const readOnly = render(view(true));
    await screen.findByText("users");
    expect(readOnly.container.querySelector(".react-flow__node-table")).not.toBeNull();
    expect(readOnly.container.querySelector(".react-flow__node-table.draggable")).toBeNull();
  });

  it("shows an empty canvas when parseResult is null", () => {
    const { container } = render(
      <div style={{ width: 800, height: 600 }}>
        <Canvas parseResult={null} layout={null} viewportKey={null} />
      </div>,
    );
    expect(container.querySelector(".react-flow")).not.toBeNull();
    expect(container.querySelector(".react-flow__node")).toBeNull();
  });

  it("gives the controls an aria-label", async () => {
    render(
      <div style={{ width: 800, height: 600 }}>
        <Canvas parseResult={null} layout={null} viewportKey={null} />
      </div>,
    );
    expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
  });
});
