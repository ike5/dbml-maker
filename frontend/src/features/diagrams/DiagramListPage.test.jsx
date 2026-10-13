import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test/server.js";
import { renderWithProviders } from "../../test/render.jsx";
import { text } from "../../text/en.js";
import { DiagramListPage } from "./DiagramListPage.jsx";
import { summary } from "./testing.js";

vi.mock("../import-export/index.js", () => ({
  ImportDialog: ({ onImported }) => (
    <button type="button" onClick={() => onImported({ id: "imp1" })}>
      Fake import
    </button>
  ),
}));

function listHandler(byScope) {
  return http.get("*/api/v1/diagrams", ({ request }) => {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const cursor = url.searchParams.get("cursor");
    return HttpResponse.json(byScope[`${scope}${cursor ? `:${cursor}` : ""}`]);
  });
}

async function openMenu(user, name) {
  await user.click(await screen.findByRole("button", { name: `Actions for ${name}` }));
}

describe("DiagramListPage", () => {
  it("shows the diagram with a link, and the time and the person of the last change", async () => {
    server.use(listHandler({ mine: { results: [summary()], next: null } }));
    renderWithProviders(<DiagramListPage />);
    const link = await screen.findByRole("link", { name: "Shop" });
    expect(link).toHaveAttribute("href", "/d/d1");
    expect(screen.getByText("Changed 5 minutes ago by Ann")).toBeInTheDocument();
  });

  it("uses the email when the person has no display name", async () => {
    const updated_by = { id: "u2", email: "bob@example.com", display_name: "" };
    server.use(listHandler({ mine: { results: [summary({ updated_by })], next: null } }));
    renderWithProviders(<DiagramListPage />);
    expect(await screen.findByText(/by bob@example.com/)).toBeInTheDocument();
  });

  it("keeps the selected tab in the URL query", async () => {
    const user = userEvent.setup();
    server.use(
      listHandler({
        mine: { results: [summary()], next: null },
        shared: { results: [summary({ id: "d2", name: "Blog", role: "viewer" })], next: null },
      }),
    );
    const { router } = renderWithProviders(<DiagramListPage />);
    await screen.findByText("Shop");
    await user.click(screen.getByRole("tab", { name: text.diagrams.tabShared }));
    expect(await screen.findByText("Blog")).toBeInTheDocument();
    expect(screen.queryByText("Shop")).not.toBeInTheDocument();
    expect(router.state.location.search).toBe("?tab=shared");
    expect(screen.getByText(/Viewer\./)).toBeInTheDocument();
  });

  it("opens the shared tab from the URL query", async () => {
    server.use(listHandler({ shared: { results: [], next: null } }));
    renderWithProviders(<DiagramListPage />, { route: "/?tab=shared" });
    expect(await screen.findByText(text.diagrams.emptyShared)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: text.diagrams.tabShared })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows the empty state of my diagrams", async () => {
    server.use(listHandler({ mine: { results: [], next: null } }));
    renderWithProviders(<DiagramListPage />);
    expect(await screen.findByText(text.diagrams.emptyMine)).toBeInTheDocument();
  });

  it("loads the next page with Load more", async () => {
    const user = userEvent.setup();
    server.use(
      listHandler({
        mine: { results: [summary()], next: "c2" },
        "mine:c2": { results: [summary({ id: "d2", name: "Blog" })], next: null },
      }),
    );
    renderWithProviders(<DiagramListPage />);
    await screen.findByText("Shop");
    await user.click(screen.getByRole("button", { name: text.diagrams.loadMore }));
    expect(await screen.findByText("Blog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.diagrams.loadMore })).not.toBeInTheDocument();
  });

  it("shows an error with a retry action", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/v1/diagrams", () =>
        HttpResponse.json({ error: { code: "server_error", message: "x" } }, { status: 500 }),
      ),
    );
    renderWithProviders(<DiagramListPage />);
    await screen.findByRole("alert");
    server.use(listHandler({ mine: { results: [summary()], next: null } }));
    await user.click(screen.getByRole("button", { name: text.common.retry }));
    expect(await screen.findByText("Shop")).toBeInTheDocument();
  });

  it("shows only the actions that the role permits", async () => {
    const user = userEvent.setup();
    server.use(
      listHandler({
        shared: {
          results: [
            summary({ id: "d2", name: "ViewOnly", role: "viewer" }),
            summary({ id: "d3", name: "EditOnly", role: "editor" }),
          ],
          next: null,
        },
      }),
    );
    renderWithProviders(<DiagramListPage />, { route: "/?tab=shared" });
    await openMenu(user, "ViewOnly");
    let menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: text.diagrams.open })).toBeInTheDocument();
    expect(
      within(menu).getByRole("menuitem", { name: text.diagrams.duplicate }),
    ).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: text.diagrams.rename })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: text.diagrams.moveToTrash })).toBeNull();
    await user.keyboard("{Escape}");
    await openMenu(user, "EditOnly");
    menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: text.diagrams.rename })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: text.diagrams.moveToTrash })).toBeNull();
  });

  it("makes a diagram with the starter source and goes to the editor", async () => {
    const user = userEvent.setup();
    let body;
    server.use(
      listHandler({ mine: { results: [], next: null } }),
      http.post("*/api/v1/diagrams", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(summary({ id: "new1", name: body.name }), {
          status: 201,
          headers: { ETag: '"1"' },
        });
      }),
    );
    const { router } = renderWithProviders(<DiagramListPage />);
    await user.click(await screen.findByRole("button", { name: text.diagrams.newDiagram }));
    const field = screen.getByLabelText(text.diagrams.nameLabel);
    expect(field).toHaveValue(text.diagrams.defaultName);
    await user.click(screen.getByRole("button", { name: text.diagrams.make }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/d/new1"));
    expect(body.name).toBe("Untitled diagram");
    expect(body.source).toContain("Table users");
  });

  it("goes to the editor after an import", async () => {
    const user = userEvent.setup();
    server.use(listHandler({ mine: { results: [], next: null } }));
    const { router } = renderWithProviders(<DiagramListPage />);
    await user.click(await screen.findByRole("button", { name: text.diagrams.importDiagram }));
    await user.click(screen.getByRole("button", { name: "Fake import" }));
    expect(router.state.location.pathname).toBe("/d/imp1");
  });

  it("validates the name before the request", async () => {
    const user = userEvent.setup();
    server.use(listHandler({ mine: { results: [], next: null } }));
    renderWithProviders(<DiagramListPage />);
    await user.click(await screen.findByRole("button", { name: text.diagrams.newDiagram }));
    await user.clear(screen.getByLabelText(text.diagrams.nameLabel));
    await user.click(screen.getByRole("button", { name: text.diagrams.make }));
    expect(await screen.findByText(text.diagrams.nameEmpty)).toBeInTheDocument();
  });

  it("renames with If-Match, and shows the field error of the API", async () => {
    const user = userEvent.setup();
    let ifMatch;
    server.use(
      listHandler({ mine: { results: [summary()], next: null } }),
      http.patch("*/api/v1/diagrams/d1", async ({ request }) => {
        ifMatch = request.headers.get("If-Match");
        const { name } = await request.json();
        if (name === "bad") {
          return HttpResponse.json(
            {
              error: {
                code: "validation_failed",
                message: "x",
                fields: { name: ["Not allowed."] },
              },
            },
            { status: 400 },
          );
        }
        return HttpResponse.json(summary({ name }), { headers: { ETag: '"4"' } });
      }),
    );
    renderWithProviders(<DiagramListPage />);
    await openMenu(user, "Shop");
    await user.click(screen.getByRole("menuitem", { name: text.diagrams.rename }));
    const field = screen.getByLabelText(text.diagrams.nameLabel);
    await user.clear(field);
    await user.type(field, "bad");
    await user.click(screen.getByRole("button", { name: text.diagrams.rename }));
    expect(await screen.findByText("Not allowed.")).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, "Store");
    await user.click(screen.getByRole("button", { name: text.diagrams.rename }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(ifMatch).toBe('"3"');
  });

  it("shows the message for HTTP 412 and loads the list again", async () => {
    const user = userEvent.setup();
    let lists = 0;
    server.use(
      http.get("*/api/v1/diagrams", () => {
        lists += 1;
        return HttpResponse.json({ results: [summary({ change_number: 3 + lists })], next: null });
      }),
      http.patch("*/api/v1/diagrams/d1", () =>
        HttpResponse.json({ error: { code: "diagram_conflict", message: "x" } }, { status: 412 }),
      ),
    );
    renderWithProviders(<DiagramListPage />);
    await openMenu(user, "Shop");
    await user.click(screen.getByRole("menuitem", { name: text.diagrams.rename }));
    await user.click(screen.getByRole("button", { name: text.diagrams.rename }));
    expect(await screen.findByText(text.errors.byCode.diagram_conflict)).toBeInTheDocument();
    await waitFor(() => expect(lists).toBe(2));
  });

  it("duplicates a diagram and shows a link to the copy", async () => {
    const user = userEvent.setup();
    server.use(
      listHandler({ mine: { results: [summary()], next: null } }),
      http.post("*/api/v1/diagrams/d1/duplicate", () =>
        HttpResponse.json(summary({ id: "d9", name: "Copy of Shop" }), {
          status: 201,
          headers: { ETag: '"1"' },
        }),
      ),
    );
    renderWithProviders(<DiagramListPage />);
    await openMenu(user, "Shop");
    await user.click(screen.getByRole("menuitem", { name: text.diagrams.duplicate }));
    const link = await screen.findByRole("link", { name: text.diagrams.openCopy });
    expect(link).toHaveAttribute("href", "/d/d9");
  });

  it("moves a diagram to the trash after a confirm", async () => {
    const user = userEvent.setup();
    let trashed = false;
    server.use(
      http.get("*/api/v1/diagrams", () =>
        HttpResponse.json({ results: trashed ? [] : [summary()], next: null }),
      ),
      http.delete("*/api/v1/diagrams/d1", () => {
        trashed = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<DiagramListPage />);
    await openMenu(user, "Shop");
    await user.click(screen.getByRole("menuitem", { name: text.diagrams.moveToTrash }));
    expect(screen.getByRole("dialog")).toHaveTextContent("30 days");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: text.diagrams.moveToTrash }),
    );
    expect(await screen.findByText(text.diagrams.emptyMine)).toBeInTheDocument();
  });
});
