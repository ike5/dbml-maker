import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test/server.js";
import { renderWithProviders } from "../../test/render.jsx";
import { text } from "../../text/en.js";
import { format } from "../../text/format.js";
import { ShareDialog } from "./index.js";

const OFF = { enabled: false, token: null, url: null, created_at: null };
const on = (token) => ({
  enabled: true,
  token,
  url: `https://app.test/p/${token}`,
  created_at: "2026-01-01T00:00:00Z",
});
const share = (id, email, role = "viewer") => ({
  id,
  email,
  role,
  created_at: "2026-01-01T00:00:00Z",
});

function renderDialog(onClose = () => {}) {
  return renderWithProviders(<ShareDialog diagramId="d1" diagramName="Shop" onClose={onClose} />);
}

// Handlers for a server with a list of shares and a state of the public link.
function mockServer({ shares = [], link = OFF } = {}) {
  const state = { shares: [...shares], link, bodies: [] };
  server.use(
    http.get("*/api/v1/diagrams/d1/shares", () =>
      HttpResponse.json({ results: state.shares, next: null }),
    ),
    http.post("*/api/v1/diagrams/d1/shares", async ({ request }) => {
      const body = await request.json();
      state.bodies.push(body);
      const created = share(`s${state.shares.length + 1}`, body.email, body.role);
      state.shares.push(created);
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch("*/api/v1/diagrams/d1/shares/:id", async ({ request, params }) => {
      const body = await request.json();
      state.bodies.push(body);
      state.shares = state.shares.map((s) => (s.id === params.id ? { ...s, ...body } : s));
      return HttpResponse.json(state.shares.find((s) => s.id === params.id));
    }),
    http.delete("*/api/v1/diagrams/d1/shares/:id", ({ params }) => {
      state.shares = state.shares.filter((s) => s.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get("*/api/v1/diagrams/d1/public-link", () => HttpResponse.json(state.link)),
    http.put("*/api/v1/diagrams/d1/public-link", () => {
      state.link = on("t1");
      return HttpResponse.json(state.link);
    }),
    http.post("*/api/v1/diagrams/d1/public-link/rotate", () => {
      state.link = on("t2");
      return HttpResponse.json(state.link);
    }),
    http.delete("*/api/v1/diagrams/d1/public-link", () => {
      state.link = OFF;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return state;
}

function failShares(status, code, extra = {}) {
  server.use(
    http.post("*/api/v1/diagrams/d1/shares", () =>
      HttpResponse.json({ error: { code, message: "x", ...extra } }, { status }),
    ),
  );
}

async function addShare(user, address, role) {
  await user.type(screen.getByLabelText(text.shares.emailLabel), address);
  if (role) await user.selectOptions(screen.getByLabelText(text.shares.roleLabel), role);
  await user.click(screen.getByRole("button", { name: text.shares.shareAction }));
}

describe("shares (spec)", () => {
  it("SHR-001 an owner shares the diagram with an email address and a role", async () => {
    const user = userEvent.setup();
    const state = mockServer();
    renderDialog();
    await addShare(user, "bob@example.com", "editor");
    expect(await screen.findByText("bob@example.com")).toBeInTheDocument();
    expect(state.bodies).toEqual([{ email: "bob@example.com", role: "editor" }]);
    expect(screen.getByLabelText(text.shares.emailLabel)).toHaveValue("");
  });

  it("SHR-002 an owner turns on the public link and sees the URL", async () => {
    const user = userEvent.setup();
    mockServer();
    renderDialog();
    await user.click(await screen.findByRole("button", { name: text.shares.linkTurnOn }));
    expect(await screen.findByDisplayValue("https://app.test/p/t1")).toHaveAttribute("readonly");
  });

  it("SHR-003 a new link replaces the old URL", async () => {
    const user = userEvent.setup();
    mockServer({ link: on("t1") });
    renderDialog();
    await screen.findByDisplayValue("https://app.test/p/t1");
    await user.click(screen.getByRole("button", { name: text.shares.linkRotate }));
    expect(screen.getByText(text.shares.linkRotateWarning)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: text.shares.linkRotateConfirm }));
    expect(await screen.findByDisplayValue("https://app.test/p/t2")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("https://app.test/p/t1")).not.toBeInTheDocument();
  });

  it("SHR-004 an owner turns off the public link", async () => {
    const user = userEvent.setup();
    mockServer({ link: on("t1") });
    renderDialog();
    await user.click(await screen.findByRole("button", { name: text.shares.linkTurnOff }));
    expect(await screen.findByText(text.shares.linkOffText)).toBeInTheDocument();
    expect(screen.queryByDisplayValue("https://app.test/p/t1")).not.toBeInTheDocument();
  });

  it("SHR-005 the message after a share is the same for each address", async () => {
    const user = userEvent.setup();
    mockServer();
    renderDialog();
    await addShare(user, "known@example.com");
    expect(
      await screen.findByText(format(text.shares.sent, { email: "known@example.com" })),
    ).toBeInTheDocument();
    await addShare(user, "new@example.com");
    expect(
      await screen.findByText(format(text.shares.sent, { email: "new@example.com" })),
    ).toBeInTheDocument();
  });
});

describe("ShareDialog", () => {
  it("changes the role of a share", async () => {
    const user = userEvent.setup();
    const state = mockServer({ shares: [share("s1", "ann@example.com")] });
    renderDialog();
    const select = await screen.findByLabelText(
      format(text.shares.roleOf, { email: "ann@example.com" }),
    );
    await user.selectOptions(select, "editor");
    await waitFor(() => expect(state.bodies).toEqual([{ role: "editor" }]));
    await waitFor(() => expect(select).toHaveValue("editor"));
  });

  it("removes a share", async () => {
    const user = userEvent.setup();
    mockServer({ shares: [share("s1", "ann@example.com")] });
    renderDialog();
    await user.click(
      await screen.findByRole("button", {
        name: format(text.shares.remove, { email: "ann@example.com" }),
      }),
    );
    expect(await screen.findByText(text.shares.noShares)).toBeInTheDocument();
  });

  it.each([
    ["share_self", 400],
    ["share_exists", 409],
    ["share_limit", 409],
    ["throttled", 429],
  ])("shows the message for the error %s", async (code, status) => {
    const user = userEvent.setup();
    mockServer();
    failShares(status, code);
    renderDialog();
    await addShare(user, "bob@example.com");
    expect(await screen.findByText(text.errors.byCode[code])).toBeInTheDocument();
  });

  it("shows validation_failed at the email field", async () => {
    const user = userEvent.setup();
    mockServer();
    failShares(400, "validation_failed", { fields: { email: ["Enter a valid email address."] } });
    renderDialog();
    await addShare(user, "bad");
    const message = await screen.findByText("Enter a valid email address.");
    expect(screen.getByLabelText(text.shares.emailLabel)).toHaveAccessibleDescription(
      message.textContent,
    );
  });

  describe("copy button", () => {
    let writeText;
    // userEvent.setup replaces the clipboard, so each test calls this after setup.
    function mockClipboard() {
      writeText = vi.fn();
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    }

    it("copies the URL and says so", async () => {
      const user = userEvent.setup();
      mockClipboard();
      writeText.mockResolvedValue();
      mockServer({ link: on("t1") });
      renderDialog();
      await screen.findByDisplayValue("https://app.test/p/t1");
      await user.click(screen.getByRole("button", { name: text.shares.linkCopy }));
      expect(writeText).toHaveBeenCalledWith("https://app.test/p/t1");
      expect(await screen.findByText(text.shares.linkCopied)).toBeInTheDocument();
    });

    it("shows a message if the clipboard fails", async () => {
      const user = userEvent.setup();
      mockClipboard();
      writeText.mockRejectedValue(new Error("denied"));
      mockServer({ link: on("t1") });
      renderDialog();
      await screen.findByDisplayValue("https://app.test/p/t1");
      await user.click(screen.getByRole("button", { name: text.shares.linkCopy }));
      expect(await screen.findByText(text.shares.linkCopyFailed)).toBeInTheDocument();
    });
  });

  it("keeps the focus in the dialog and closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockServer();
    renderDialog(onClose);
    const dialog = await screen.findByRole("dialog", {
      name: format(text.shares.title, { name: "Shop" }),
    });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement));
    expect(screen.getByLabelText(text.shares.emailLabel)).toHaveFocus();
    for (let i = 0; i < 12; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement);
    }
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
