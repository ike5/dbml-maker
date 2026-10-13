import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { text } from "../../text/en.js";
import { listHandler, renderPanel, server, version } from "./testing.jsx";

describe("VersionPanel", () => {
  it("shows the list with kind, label, person, and change number", async () => {
    server.use(
      listHandler({
        first: {
          results: [
            version(),
            version({ id: "v2", kind: "auto", label: "", created_by: null, change_number: 2 }),
            version({
              id: "v3",
              kind: "restore",
              label: "",
              created_by: { id: "u2", email: "bob@example.com", display_name: "" },
            }),
          ],
          next: null,
        },
      }),
    );
    renderPanel();
    expect(await screen.findByText("Before launch")).toBeInTheDocument();
    expect(screen.getByText(text.versions.kindNamed)).toBeInTheDocument();
    expect(screen.getByText(text.versions.kindAuto)).toBeInTheDocument();
    expect(screen.getByText(text.versions.kindRestore)).toBeInTheDocument();
    expect(screen.getByText(/by Ann/)).toBeInTheDocument();
    expect(screen.getByText(/by Unknown person/)).toBeInTheDocument();
    expect(screen.getByText(/by bob@example.com/)).toBeInTheDocument();
    expect(screen.getAllByText("Change number 4")[0]).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: text.versions.title })).toBeInTheDocument();
  });

  it("loads more versions", async () => {
    const user = userEvent.setup();
    server.use(
      listHandler({
        first: { results: [version({ label: "First" })], next: "c2" },
        c2: { results: [version({ id: "v2", label: "Second" })], next: null },
      }),
    );
    renderPanel();
    await screen.findByText("First");
    await user.click(screen.getByRole("button", { name: text.versions.loadMore }));
    expect(await screen.findByText("Second")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.versions.loadMore })).toBeNull();
  });

  it("shows the empty state", async () => {
    server.use(listHandler({ first: { results: [], next: null } }));
    renderPanel();
    expect(await screen.findByText(text.versions.empty)).toBeInTheDocument();
  });

  it("shows an error and retries", async () => {
    const user = userEvent.setup();
    let fail = true;
    server.use(
      http.get("*/api/v1/diagrams/d1/versions", () =>
        fail
          ? HttpResponse.json({ error: { code: "server_error", message: "" } }, { status: 500 })
          : HttpResponse.json({ results: [version()], next: null }),
      ),
    );
    renderPanel();
    const retry = await screen.findByRole("button", { name: text.common.retry });
    fail = false;
    await user.click(retry);
    expect(await screen.findByText("Before launch")).toBeInTheDocument();
  });

  it("gives a viewer the list and Show, but no form and no Restore", async () => {
    server.use(listHandler({ first: { results: [version()], next: null } }));
    renderPanel({ canEdit: false });
    await screen.findByText("Before launch");
    expect(screen.getByRole("button", { name: /^Show the version/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Restore/ })).toBeNull();
    expect(screen.queryByLabelText(text.versions.labelLabel)).toBeNull();
  });

  it("EDT-005 shows a source with a script tag as text", async () => {
    const user = userEvent.setup();
    const source = "Table a { id int } // <script>window.hacked = true</script>";
    server.use(
      listHandler({ first: { results: [version()], next: null } }),
      http.get("*/api/v1/diagrams/d1/versions/v1", () =>
        HttpResponse.json({ ...version(), source, layout: { format: 1, tables: {} } }),
      ),
    );
    renderPanel();
    await user.click(await screen.findByRole("button", { name: /^Show the version/ }));
    const pre = await screen.findByText(/Table a/);
    expect(pre.tagName).toBe("PRE");
    expect(pre.textContent).toBe(source);
    expect(pre.querySelector("script")).toBeNull();
    expect(window.hacked).toBeUndefined();
  });

  it("rejects an empty label and a label with more than 200 characters", async () => {
    const user = userEvent.setup();
    let posts = 0;
    server.use(
      listHandler({ first: { results: [], next: null } }),
      http.post("*/api/v1/diagrams/d1/versions", () => {
        posts += 1;
        return HttpResponse.json(version(), { status: 201 });
      }),
    );
    renderPanel();
    const submit = await screen.findByRole("button", { name: text.versions.make });
    await user.click(submit);
    expect(await screen.findByText(text.versions.labelEmpty)).toBeInTheDocument();
    await user.click(screen.getByLabelText(text.versions.labelLabel));
    await user.paste("x".repeat(201));
    await user.click(submit);
    expect(await screen.findByText(text.versions.labelTooLong)).toBeInTheDocument();
    expect(posts).toBe(0);
  });

  it("shows a field error from the server", async () => {
    const user = userEvent.setup();
    server.use(
      listHandler({ first: { results: [], next: null } }),
      http.post("*/api/v1/diagrams/d1/versions", () =>
        HttpResponse.json(
          { error: { code: "validation_failed", message: "", fields: { label: ["Bad label."] } } },
          { status: 400 },
        ),
      ),
    );
    renderPanel();
    await user.type(await screen.findByLabelText(text.versions.labelLabel), "x");
    await user.click(screen.getByRole("button", { name: text.versions.make }));
    expect(await screen.findByText("Bad label.")).toBeInTheDocument();
  });

  it("shows the 412 message when the restore conflicts", async () => {
    const user = userEvent.setup();
    server.use(
      listHandler({ first: { results: [version()], next: null } }),
      http.post("*/api/v1/diagrams/d1/versions/v1/restore", () =>
        HttpResponse.json(
          { error: { code: "diagram_conflict", message: "Old." } },
          { status: 412 },
        ),
      ),
    );
    const { onRestored } = renderPanel();
    await user.click(await screen.findByRole("button", { name: /^Restore the version/ }));
    await user.click(screen.getByRole("button", { name: text.versions.restore }));
    expect(await screen.findByText(text.versions.restoreConflict)).toBeInTheDocument();
    expect(onRestored).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });
});
