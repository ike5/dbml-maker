import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render.jsx";
import { server } from "../../test/server.js";
import { text } from "../../text/en.js";
import { EditorPage } from "./index.js";
import { diagram, person, serveDiagram } from "./testing.jsx";
import { parse } from "../../lib/dbml/index.js";

vi.mock("./code/CodePane.jsx", async () => (await import("./testing.jsx")).codePaneMock);
vi.mock("./canvas/Canvas.jsx", async () => (await import("./testing.jsx")).canvasMock);
vi.mock("../import-export/index.js", () => ({ ExportDialog: () => null }));
vi.mock("../shares/index.js", () => ({ ShareDialog: () => null }));
vi.mock("../versions/index.js", () => ({ VersionPanel: () => null }));
vi.mock("../../lib/dbml/index.js", async (importOriginal) => ({
  ...(await importOriginal()),
  parse: vi.fn(),
}));

const parseError = { message: "Unexpected token", line: 1, column: 1, endLine: 1, endColumn: 4 };

function answerParse() {
  parse.mockImplementation(async (source) =>
    source.includes("BAD")
      ? { result: null, errors: [parseError] }
      : { result: { marker: source }, errors: [] },
  );
}

async function openEditor(overrides = {}) {
  serveDiagram(overrides);
  const view = renderWithProviders(<EditorPage />, { route: "/d/d1", path: "/d/:diagramId" });
  await screen.findByRole("textbox", { name: text.editorCode.defaultLabel });
  return view;
}

const advance = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));
const type = (value) =>
  fireEvent.change(screen.getByRole("textbox", { name: text.editorCode.defaultLabel }), {
    target: { value },
  });

describe("editor (spec)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    answerParse();
  });
  afterEach(() => {
    vi.useRealTimers();
    parse.mockReset();
  });

  it("EDT-001 the editor sends the source to the parse worker 250 ms after the last change", async () => {
    // The check of the delay must not depend on the real clock, so the clock is fully fake.
    vi.useRealTimers();
    await openEditor();
    vi.useFakeTimers();
    await advance(0);
    parse.mockClear();
    type("Table b {}");
    await advance(200);
    type("Table bc {}");
    await advance(249);
    expect(parse).not.toHaveBeenCalled();
    await advance(1);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledWith("Table bc {}");
  });

  it("EDT-002 the editor gives the parse errors to the code pane and keeps the last correct parse result for the canvas", async () => {
    await openEditor();
    await advance(0);
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-result", "Table a {}");
    type("BAD source");
    await advance(250);
    expect(screen.getByRole("list", { name: "parse errors" })).toHaveTextContent(
      parseError.message,
    );
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-result", "Table a {}");
    type("Table c {}");
    await advance(250);
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-result", "Table c {}");
    expect(screen.queryByText(parseError.message)).not.toBeInTheDocument();
  });

  it("EDT-003 the editor saves 1 second after the last change", async () => {
    const requests = [];
    server.use(
      http.patch("*/api/v1/diagrams/d1", async ({ request }) => {
        requests.push({ ifMatch: request.headers.get("If-Match"), body: await request.json() });
        return HttpResponse.json(diagram({ source: "Table d {}" }), { headers: { ETag: '"4"' } });
      }),
    );
    vi.useRealTimers();
    await openEditor();
    vi.useFakeTimers();
    type("Table d {}");
    await advance(999);
    expect(requests).toHaveLength(0);
    await advance(1);
    vi.useRealTimers();
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toEqual({ ifMatch: '"3"', body: { source: "Table d {}" } });
    expect(await screen.findByText(text.editor.statusSaved)).toBeInTheDocument();
  });

  function conflictHandler(counter) {
    return http.patch("*/api/v1/diagrams/d1", () => {
      counter.count += 1;
      return HttpResponse.json(
        {
          error: {
            code: "diagram_conflict",
            message: "conflict",
            current: {
              change_number: 9,
              updated_by: person,
              updated_at: "2026-03-02T10:00:00Z",
            },
          },
        },
        { status: 412 },
      );
    });
  }

  it("DGM-002 a 412 stops the autosave and shows the conflict banner", async () => {
    const counter = { count: 0 };
    server.use(conflictHandler(counter));
    await openEditor();
    type("Table e {}");
    await advance(1000);
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Bob");
    expect(screen.getByRole("button", { name: text.editor.conflictLoad })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.editor.conflictKeep })).toBeInTheDocument();
    type("Table ef {}");
    await advance(5000);
    expect(counter.count).toBe(1);
  });

  it('DGM-002 "Keep my version" makes the version "Before overwrite" and then saves with the new change number', async () => {
    const calls = [];
    let patches = 0;
    server.use(
      http.patch("*/api/v1/diagrams/d1", async ({ request }) => {
        patches += 1;
        calls.push(`patch ${request.headers.get("If-Match")}`);
        if (patches === 1) {
          return HttpResponse.json(
            { error: { code: "diagram_conflict", message: "x", current: { change_number: 9 } } },
            { status: 412 },
          );
        }
        return HttpResponse.json(diagram({ source: "Table g {}" }), { headers: { ETag: '"10"' } });
      }),
      http.post("*/api/v1/diagrams/d1/versions", async ({ request }) => {
        calls.push(`version ${(await request.json()).label}`);
        return HttpResponse.json({ id: "v9", label: "Before overwrite" }, { status: 201 });
      }),
    );
    await openEditor();
    type("Table g {}");
    await advance(1000);
    // The second read of the diagram gives the new change number.
    serveDiagram({ source: "Other" }, 9);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole("button", { name: text.editor.conflictKeep }));
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls).toEqual(['patch "3"', "version Before overwrite", 'patch "9"']);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: text.editorCode.defaultLabel })).toHaveValue(
      "Table g {}",
    );
  });

  it("EDT-005 the editor shows the diagram name as plain text", async () => {
    await openEditor({ name: "<b>Bold</b> name" });
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("<b>Bold</b> name");
    expect(heading.querySelector("b")).toBeNull();
  });
});
