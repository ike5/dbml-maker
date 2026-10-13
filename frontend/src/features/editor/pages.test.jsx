import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "../../lib/dbml/index.js";
import { renderWithProviders } from "../../test/render.jsx";
import { server } from "../../test/server.js";
import { text } from "../../text/en.js";
import { EditorPage, PublicViewPage } from "./index.js";
import { SPLIT_STORAGE_KEY } from "./SplitLayout.jsx";
import { canvasCalls, diagram, serveDiagram } from "./testing.jsx";

vi.mock("./code/CodePane.jsx", async () => (await import("./testing.jsx")).codePaneMock);
vi.mock("./canvas/Canvas.jsx", async () => (await import("./testing.jsx")).canvasMock);
vi.mock("../../lib/dbml/index.js", async (importOriginal) => ({
  ...(await importOriginal()),
  parse: vi.fn(),
}));
vi.mock("../import-export/index.js", () => ({
  ExportDialog: ({ name, exportImage, onClose }) => (
    <div role="dialog" aria-label="export">
      <p>{name}</p>
      <button onClick={() => exportImage("png")}>export png</button>
      <button onClick={onClose}>close export</button>
    </div>
  ),
}));
vi.mock("../shares/index.js", () => ({
  ShareDialog: ({ diagramName }) => (
    <div role="dialog" aria-label="share">
      {diagramName}
    </div>
  ),
}));
vi.mock("../versions/index.js", () => ({
  VersionPanel: ({ getChangeNumber, onRestored }) => (
    <aside aria-label="versions panel">
      <p data-testid="change-number">{getChangeNumber()}</p>
      <button
        onClick={() =>
          onRestored({ diagram: diagram({ name: "Restored", source: "Table r {}" }), etag: 12 })
        }
      >
        restore
      </button>
    </aside>
  ),
}));

const codeBox = () => screen.getByRole("textbox", { name: text.editorCode.defaultLabel });

function renderEditor() {
  return renderWithProviders(<EditorPage />, { route: "/d/d1", path: "/d/:diagramId" });
}

async function openEditor(overrides = {}) {
  serveDiagram(overrides);
  const view = renderEditor();
  await screen.findByRole("textbox", { name: text.editorCode.defaultLabel });
  return view;
}

function loggedIn(isLoggedIn) {
  server.use(
    http.get("*/_allauth/browser/v1/auth/session", () =>
      isLoggedIn
        ? HttpResponse.json({
            status: 200,
            data: { user: { id: 1, email: "ann@example.com", display: "Ann" }, methods: [] },
            meta: { is_authenticated: true },
          })
        : HttpResponse.json(
            { status: 401, data: { flows: [] }, meta: { is_authenticated: false } },
            { status: 401 },
          ),
    ),
  );
}

describe("editor page", () => {
  beforeEach(() => {
    parse.mockImplementation(async (source) => ({ result: { marker: source }, errors: [] }));
    localStorage.clear();
    canvasCalls.arrange.mockClear();
    canvasCalls.fitView.mockClear();
    canvasCalls.exportImage.mockClear();
  });
  afterEach(() => parse.mockReset());

  it("shows all tools to an owner", async () => {
    await openEditor({ role: "owner" });
    for (const label of [
      text.editor.arrange,
      text.editor.fit,
      text.editor.versions,
      text.editor.share,
      text.editor.export,
      text.editor.duplicate,
      text.editor.rename,
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText(text.editor.statusSaved)).toBeInTheDocument();
    expect(codeBox()).not.toHaveAttribute("readonly");
  });

  it("hides the Share button from an editor", async () => {
    await openEditor({ role: "editor" });
    expect(screen.queryByRole("button", { name: text.editor.share })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.editor.arrange })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.editor.rename })).toBeInTheDocument();
  });

  it("makes a viewer read only but lets the viewer export and duplicate", async () => {
    await openEditor({ role: "viewer" });
    expect(screen.getByText(text.editor.viewerNote)).toBeInTheDocument();
    expect(codeBox()).toHaveAttribute("readonly");
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-readonly", "true");
    expect(screen.queryByRole("button", { name: text.editor.arrange })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.editor.rename })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.editor.share })).not.toBeInTheDocument();
    expect(screen.queryByText(text.editor.statusSaved)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.editor.export })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.editor.duplicate })).toBeInTheDocument();
  });

  it("does not save for a viewer", async () => {
    let patches = 0;
    server.use(
      http.patch("*/api/v1/diagrams/d1", () => {
        patches += 1;
        return HttpResponse.json(diagram(), { headers: { ETag: '"4"' } });
      }),
    );
    await openEditor({ role: "viewer" });
    canvasCalls.props.onLayoutChange({ format: 1, tables: { a: { x: 1, y: 1 } } });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(patches).toBe(0);
  });

  it("calls the canvas for Arrange and Fit", async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole("button", { name: text.editor.arrange }));
    await user.click(screen.getByRole("button", { name: text.editor.fit }));
    expect(canvasCalls.arrange).toHaveBeenCalledTimes(1);
    expect(canvasCalls.fitView).toHaveBeenCalledTimes(1);
  });

  it("gives the viewport key and the layout to the canvas", async () => {
    await openEditor({ layout: { format: 1, tables: { a: { x: 4, y: 5 }, b: { x: "q" } } } });
    expect(screen.getByTestId("canvas")).toHaveAttribute(
      "data-viewport-key",
      "dbml-maker:viewport:d1",
    );
    expect(canvasCalls.props.layout).toEqual({ format: 1, tables: { a: { x: 4, y: 5 } } });
  });

  it("shows an empty state for a diagram that does not exist", async () => {
    server.use(
      http.get("*/api/v1/diagrams/d1", () =>
        HttpResponse.json({ error: { code: "diagram_not_found", message: "x" } }, { status: 404 }),
      ),
    );
    renderEditor();
    expect(await screen.findByText(text.editor.notFoundTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.editor.notFoundAction })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("shows a banner with Try again for another error", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/v1/diagrams/d1", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: { code: "server_error", message: "x" } }, { status: 500 })
          : HttpResponse.json(diagram(), { headers: { ETag: '"3"' } });
      }),
    );
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole("button", { name: text.common.retry }));
    expect(
      await screen.findByRole("textbox", { name: text.editorCode.defaultLabel }),
    ).toBeInTheDocument();
  });

  it("duplicates the diagram and goes to the new diagram", async () => {
    server.use(
      http.post("*/api/v1/diagrams/d1/duplicate", () =>
        HttpResponse.json(diagram({ id: "d2", name: "Shop copy" }), {
          status: 201,
          headers: { ETag: '"1"' },
        }),
      ),
      http.get("*/api/v1/diagrams/d2", () =>
        HttpResponse.json(diagram({ id: "d2", name: "Shop copy" }), { headers: { ETag: '"1"' } }),
      ),
    );
    const user = userEvent.setup();
    const { router, queryClient } = await openEditor({ role: "viewer" });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await user.click(screen.getByRole("button", { name: text.editor.duplicate }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/d/d2"));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["diagrams"] });
    expect(await screen.findByRole("heading", { level: 1, name: "Shop copy" })).toBeInTheDocument();
  });

  it("renames the diagram with Enter and saves the new name", async () => {
    const bodies = [];
    server.use(
      http.patch("*/api/v1/diagrams/d1", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(diagram({ name: "Renamed" }), { headers: { ETag: '"4"' } });
      }),
    );
    const user = userEvent.setup();
    const { queryClient } = await openEditor();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await user.click(screen.getByRole("button", { name: text.editor.rename }));
    const field = screen.getByRole("textbox", { name: text.editor.nameLabel });
    await user.clear(field);
    await user.type(field, "Renamed{Enter}");
    expect(screen.getByRole("heading", { level: 1, name: "Renamed" })).toBeInTheDocument();
    await waitFor(() => expect(bodies).toEqual([{ name: "Renamed" }]), { timeout: 3000 });
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["diagrams"] }));
  });

  it("cancels the rename with Escape and refuses an empty name", async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole("button", { name: text.editor.rename }));
    await user.type(screen.getByRole("textbox", { name: text.editor.nameLabel }), "x{Escape}");
    expect(screen.getByRole("heading", { level: 1, name: "Shop" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: text.editor.rename }));
    await user.clear(screen.getByRole("textbox", { name: text.editor.nameLabel }));
    await user.keyboard("{Enter}");
    expect(screen.getByText(text.editor.nameEmpty)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: text.editor.nameLabel })).toBeInTheDocument();
  });

  it("refuses a name with more than 200 characters", async () => {
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: text.editor.rename }));
    const field = screen.getByRole("textbox", { name: text.editor.nameLabel });
    fireEvent.change(field, { target: { value: "x".repeat(201) } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(screen.getByText(text.editor.nameTooLong)).toBeInTheDocument();
  });

  it("opens the version panel, gives it the change number, and loads a restored diagram", async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole("button", { name: text.editor.versions }));
    expect(screen.getByTestId("change-number")).toHaveTextContent("3");
    await user.click(screen.getByRole("button", { name: "restore" }));
    expect(screen.getByRole("heading", { level: 1, name: "Restored" })).toBeInTheDocument();
    expect(codeBox()).toHaveValue("Table r {}");
    expect(screen.getByText(text.editor.statusSaved)).toBeInTheDocument();
    // The change number of the restored diagram is the new base for saves.
    await user.click(screen.getByRole("button", { name: text.editor.versions }));
    await user.click(screen.getByRole("button", { name: text.editor.versions }));
    expect(screen.getByTestId("change-number")).toHaveTextContent("12");
  });

  it("opens and closes the export dialog with the exportImage function of the canvas", async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole("button", { name: text.editor.export }));
    expect(screen.getByRole("dialog", { name: "export" })).toHaveTextContent("Shop");
    await user.click(screen.getByRole("button", { name: "export png" }));
    expect(canvasCalls.exportImage).toHaveBeenCalledWith("png");
    await user.click(screen.getByRole("button", { name: "close export" }));
    expect(screen.queryByRole("dialog", { name: "export" })).not.toBeInTheDocument();
  });

  it("opens the share dialog for an owner", async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole("button", { name: text.editor.share }));
    expect(screen.getByRole("dialog", { name: "share" })).toHaveTextContent("Shop");
  });

  it("moves the divider with the arrow keys and keeps the ratio", async () => {
    const user = userEvent.setup();
    await openEditor();
    const divider = screen.getByRole("separator");
    expect(divider).toHaveAttribute("aria-orientation", "vertical");
    expect(divider).toHaveAttribute("aria-valuenow", "40");
    divider.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(divider).toHaveAttribute("aria-valuenow", "44");
    await user.keyboard("{ArrowLeft}");
    expect(divider).toHaveAttribute("aria-valuenow", "42");
    expect(localStorage.getItem(SPLIT_STORAGE_KEY)).toBe("42");
  });

  it("starts with the stored ratio of the divider", async () => {
    localStorage.setItem(SPLIT_STORAGE_KEY, "60");
    await openEditor();
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "60");
  });
});

describe("public view page", () => {
  beforeEach(() => {
    parse.mockImplementation(async (source) => ({ result: { marker: source }, errors: [] }));
    localStorage.clear();
  });
  afterEach(() => parse.mockReset());

  const publicDiagram = {
    name: "Public shop",
    source: "Table p {}",
    layout: { format: 1, tables: {} },
    updated_at: "2026-03-01T10:00:00Z",
  };

  function renderPublic() {
    server.use(http.get("*/api/v1/public/tok1", () => HttpResponse.json(publicDiagram)));
    return renderWithProviders(<PublicViewPage />, { route: "/s/tok1", path: "/s/:token" });
  }

  it("shows the read only diagram to a user who is not logged in", async () => {
    loggedIn(false);
    renderPublic();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Public shop" }),
    ).toBeInTheDocument();
    expect(codeBox()).toHaveValue("Table p {}");
    expect(codeBox()).toHaveAttribute("readonly");
    expect(screen.getByTestId("canvas")).toHaveAttribute(
      "data-viewport-key",
      "dbml-maker:viewport:public:tok1",
    );
    expect(screen.getByText(text.editor.publicNote)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.app.name })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: text.editor.export })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("link", { name: text.editor.loginToCopy })).toHaveAttribute(
        "href",
        "/login?next=/s/tok1",
      ),
    );
    expect(screen.queryByRole("button", { name: text.editor.makeCopy })).not.toBeInTheDocument();
  });

  it("gives a logged-in user the Make a copy button", async () => {
    loggedIn(true);
    server.use(
      http.post("*/api/v1/public/tok1/duplicate", () =>
        HttpResponse.json(diagram({ id: "d9" }), { status: 201, headers: { ETag: '"1"' } }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderPublic();
    await user.click(await screen.findByRole("button", { name: text.editor.makeCopy }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/d/d9"));
  });

  it("shows an empty state for a public link that does not exist", async () => {
    loggedIn(false);
    server.use(
      http.get("*/api/v1/public/tok1", () =>
        HttpResponse.json(
          { error: { code: "public_link_not_found", message: "x" } },
          { status: 404 },
        ),
      ),
    );
    renderWithProviders(<PublicViewPage />, { route: "/s/tok1", path: "/s/:token" });
    expect(await screen.findByText(text.editor.publicNotFoundTitle)).toBeInTheDocument();
    expect(screen.getByText(text.editor.publicNotFoundBody)).toBeInTheDocument();
  });
});
