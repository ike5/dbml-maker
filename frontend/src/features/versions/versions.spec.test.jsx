import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { text } from "../../text/en.js";
import { listHandler, renderPanel, server, version } from "./testing.jsx";

describe("versions (spec)", () => {
  it("VER-001 an editor makes a named version with a label", async () => {
    const user = userEvent.setup();
    let body = null;
    let made = false;
    server.use(
      http.get("*/api/v1/diagrams/d1/versions", () =>
        HttpResponse.json({ results: made ? [version({ label: "Release 1" })] : [], next: null }),
      ),
      http.post("*/api/v1/diagrams/d1/versions", async ({ request }) => {
        body = await request.json();
        made = true;
        return HttpResponse.json(version({ label: "Release 1" }), { status: 201 });
      }),
    );
    renderPanel();
    const field = await screen.findByLabelText(text.versions.labelLabel);
    await user.type(field, "Release 1");
    await user.click(screen.getByRole("button", { name: text.versions.make }));
    expect(await screen.findByText(text.versions.made)).toBeInTheDocument();
    expect(body).toEqual({ label: "Release 1" });
    expect(field).toHaveValue("");
    expect(await screen.findByText("Release 1")).toBeInTheDocument();
  });

  it("VER-003 restore sends the change number of the editor and gives the restored diagram to the editor", async () => {
    const user = userEvent.setup();
    let ifMatch = null;
    const restored = { id: "d1", name: "Shop", source: "Table a {}", change_number: 8 };
    server.use(
      listHandler({ first: { results: [version()], next: null } }),
      http.post("*/api/v1/diagrams/d1/versions/v1/restore", ({ request }) => {
        ifMatch = request.headers.get("If-Match");
        return HttpResponse.json(restored, { headers: { ETag: '"8"' } });
      }),
    );
    const { onRestored, getChangeNumber } = renderPanel();
    await user.click(await screen.findByRole("button", { name: /^Restore the version/ }));
    // The panel reads the change number at the confirm, not before.
    expect(getChangeNumber).not.toHaveBeenCalled();
    expect(screen.getByText(text.versions.restoreBody)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: text.versions.restore }));
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith({ diagram: restored, etag: 8 }));
    expect(ifMatch).toBe('"7"');
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
