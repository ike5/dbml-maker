// Test data and mocks for the page tests of this feature. CodeMirror and React Flow need
// browser layout, so the page tests replace the code pane and the canvas.
import { useImperativeHandle } from "react";
import { vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server.js";

export const canvasCalls = {
  arrange: vi.fn(),
  fitView: vi.fn(),
  exportImage: vi.fn(),
  /** The props of the last render of the mock canvas. */
  props: null,
};

export const codePaneMock = {
  CodePane: function CodePane({ value, onChange, errors, readOnly, label }) {
    return (
      <>
        <textarea
          aria-label={label}
          value={value}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
        />
        <ul aria-label="parse errors">
          {errors.map((error) => (
            <li key={error.message}>{error.message}</li>
          ))}
        </ul>
      </>
    );
  },
};

export const canvasMock = {
  Canvas: function Canvas({ ref, parseResult, layout, onLayoutChange, readOnly, viewportKey }) {
    canvasCalls.props = { parseResult, layout, onLayoutChange, readOnly, viewportKey };
    useImperativeHandle(ref, () => ({
      arrange: canvasCalls.arrange,
      fitView: canvasCalls.fitView,
      exportImage: canvasCalls.exportImage,
    }));
    return (
      <div
        data-testid="canvas"
        data-readonly={String(readOnly)}
        data-viewport-key={viewportKey}
        data-result={parseResult ? parseResult.marker : "none"}
      />
    );
  },
};

export const person = { id: "u2", email: "bob@example.com", display_name: "Bob" };

export function diagram(overrides = {}) {
  return {
    id: "d1",
    name: "Shop",
    role: "owner",
    change_number: 3,
    updated_at: "2026-03-01T10:00:00Z",
    updated_by: person,
    trashed_at: null,
    workspace_id: "w1",
    source: "Table a {}",
    layout: { format: 1, tables: {} },
    created_at: "2026-03-01T09:00:00Z",
    ...overrides,
  };
}

/** Answer GET /diagrams/d1 with the diagram and the change number. */
export function serveDiagram(overrides = {}, etag = 3) {
  server.use(
    http.get("*/api/v1/diagrams/d1", () =>
      HttpResponse.json(diagram(overrides), { headers: { ETag: `"${etag}"` } }),
    ),
  );
}
