import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/server.js";
import { renderWithProviders } from "../../test/render.jsx";
import { text } from "../../text/en.js";
import { TrashPage } from "./TrashPage.jsx";
import { summary } from "./testing.js";

const trashed = () =>
  summary({ id: "t1", name: "Old", trashed_at: new Date(Date.now() - 3600 * 1000).toISOString() });

describe("TrashPage", () => {
  it("shows the diagram as text, not as a link, with the delete date", async () => {
    server.use(
      http.get("*/api/v1/diagrams", () => HttpResponse.json({ results: [trashed()], next: null })),
    );
    renderWithProviders(<TrashPage />);
    expect(await screen.findByText("Old")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(/Moved to trash 1 hour ago/)).toBeInTheDocument();
    expect(screen.getByText(/The system deletes it on/)).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    server.use(http.get("*/api/v1/diagrams", () => HttpResponse.json({ results: [], next: null })));
    renderWithProviders(<TrashPage />);
    expect(await screen.findByText(text.diagrams.trashEmpty)).toBeInTheDocument();
  });

  it("restores a diagram and invalidates the lists", async () => {
    const user = userEvent.setup();
    let restored = false;
    server.use(
      http.get("*/api/v1/diagrams", () =>
        HttpResponse.json({ results: restored ? [] : [trashed()], next: null }),
      ),
      http.post("*/api/v1/diagrams/t1/restore", () => {
        restored = true;
        return HttpResponse.json(summary({ id: "t1" }), { headers: { ETag: '"2"' } });
      }),
    );
    const { queryClient } = renderWithProviders(<TrashPage />);
    queryClient.setQueryData(["diagrams", "mine"], { pages: [], pageParams: [] });
    await user.click(await screen.findByRole("button", { name: text.diagrams.restore }));
    expect(await screen.findByText(text.diagrams.trashEmpty)).toBeInTheDocument();
    expect(queryClient.getQueryState(["diagrams", "mine"]).isInvalidated).toBe(true);
  });

  it("deletes a diagram permanently after a confirm", async () => {
    const user = userEvent.setup();
    let deleted = false;
    server.use(
      http.get("*/api/v1/diagrams", () =>
        HttpResponse.json({ results: deleted ? [] : [trashed()], next: null }),
      ),
      http.delete("*/api/v1/diagrams/t1/permanent", () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithProviders(<TrashPage />);
    await user.click(await screen.findByRole("button", { name: text.diagrams.deletePermanently }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("cannot undo");
    await user.click(within(dialog).getByRole("button", { name: text.diagrams.deletePermanently }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText(text.diagrams.trashEmpty)).toBeInTheDocument();
  });
});
