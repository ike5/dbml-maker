import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { server } from "../../test/server.js";
import { makeTestQueryClient } from "../../test/render.jsx";
import { text } from "../../text/en.js";
import { DiagramListPage, TrashPage } from "./index.js";
import { summary } from "./testing.js";

// A router with both routes, so that a test can move from one page to the other.
function renderApp(route = "/") {
  const router = createMemoryRouter(
    [
      { path: "/", element: <DiagramListPage /> },
      { path: "/trash", element: <TrashPage /> },
      { path: "/d/:id", element: <p>Editor</p> },
    ],
    { initialEntries: [route] },
  );
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("diagrams (spec)", () => {
  it("DGM-001 the user can make, open, rename, and duplicate a diagram", async () => {
    const user = userEvent.setup();
    let name = "Shop";
    server.use(
      http.get("*/api/v1/diagrams", () =>
        HttpResponse.json({ results: [summary({ name })], next: null }),
      ),
      http.post("*/api/v1/diagrams", () =>
        HttpResponse.json(summary({ id: "new1" }), { status: 201, headers: { ETag: '"1"' } }),
      ),
      http.patch("*/api/v1/diagrams/d1", async ({ request }) => {
        name = (await request.json()).name;
        return HttpResponse.json(summary({ name }), { headers: { ETag: '"4"' } });
      }),
      http.post("*/api/v1/diagrams/d1/duplicate", () =>
        HttpResponse.json(summary({ id: "d2" }), { status: 201, headers: { ETag: '"1"' } }),
      ),
    );

    // Rename.
    const router = renderApp();
    await user.click(await screen.findByRole("button", { name: "Actions for Shop" }));
    await user.click(screen.getByRole("menuitem", { name: text.diagrams.rename }));
    const field = screen.getByLabelText(text.diagrams.nameLabel);
    await user.clear(field);
    await user.type(field, "Store");
    await user.click(screen.getByRole("button", { name: text.diagrams.rename }));
    expect(await screen.findByRole("link", { name: "Store" })).toBeInTheDocument();

    // Duplicate.
    await user.click(screen.getByRole("button", { name: "Actions for Store" }));
    await user.click(screen.getByRole("menuitem", { name: text.diagrams.duplicate }));
    expect(await screen.findByRole("link", { name: text.diagrams.openCopy })).toHaveAttribute(
      "href",
      "/d/d2",
    );

    // Open.
    await user.click(screen.getByRole("link", { name: "Store" }));
    expect(router.state.location.pathname).toBe("/d/d1");
  });

  it("DGM-001 the user can make a diagram and go to the editor", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/v1/diagrams", () => HttpResponse.json({ results: [], next: null })),
      http.post("*/api/v1/diagrams", () =>
        HttpResponse.json(summary({ id: "new1" }), { status: 201, headers: { ETag: '"1"' } }),
      ),
    );
    const router = renderApp();
    await user.click(await screen.findByRole("button", { name: text.diagrams.newDiagram }));
    await user.click(screen.getByRole("button", { name: text.diagrams.make }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/d/new1"));
  });

  it("DGM-004 a delete moves the diagram to the trash, and the owner can restore it", async () => {
    const user = userEvent.setup();
    let inTrash = false;
    server.use(
      http.get("*/api/v1/diagrams", ({ request }) => {
        const scope = new URL(request.url).searchParams.get("scope");
        const item = summary({ trashed_at: new Date().toISOString() });
        const results = (scope === "trash") === inTrash ? [item] : [];
        return HttpResponse.json({ results, next: null });
      }),
      http.delete("*/api/v1/diagrams/d1", () => {
        inTrash = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.post("*/api/v1/diagrams/d1/restore", () => {
        inTrash = false;
        return HttpResponse.json(summary(), { headers: { ETag: '"5"' } });
      }),
    );
    const router = renderApp();
    await user.click(await screen.findByRole("button", { name: "Actions for Shop" }));
    await user.click(screen.getByRole("menuitem", { name: text.diagrams.moveToTrash }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: text.diagrams.moveToTrash }),
    );
    expect(await screen.findByText(text.diagrams.emptyMine)).toBeInTheDocument();

    await router.navigate("/trash");
    await user.click(await screen.findByRole("button", { name: text.diagrams.restore }));
    expect(await screen.findByText(text.diagrams.trashEmpty)).toBeInTheDocument();

    await router.navigate("/");
    expect(await screen.findByRole("link", { name: "Shop" })).toBeInTheDocument();
  });
});
