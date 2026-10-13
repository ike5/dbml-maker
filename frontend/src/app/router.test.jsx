import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { text } from "../text/en.js";
import { makeTestQueryClient } from "../test/render.jsx";
import { server } from "../test/server.js";
import { createTestRouter } from "./router.jsx";

function renderRoute(url) {
  const router = createTestRouter([url]);
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("router", () => {
  it("renders the login page at /login without the app header", async () => {
    renderRoute("/login");
    expect(await screen.findByRole("heading", { name: text.auth.login.title })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("goes to /login with the next parameter at / without a session", async () => {
    const router = renderRoute("/");
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe("?next=%2F");
  });

  it("renders the diagram list in the app shell at / with a session", async () => {
    server.use(
      http.get("*/_allauth/browser/v1/auth/session", () =>
        HttpResponse.json({
          status: 200,
          data: { user: { id: "1", email: "ann@example.com", display: "Ann" }, methods: [] },
          meta: { is_authenticated: true },
        }),
      ),
      http.get("*/api/v1/diagrams", () => HttpResponse.json({ results: [], next: null })),
    );
    renderRoute("/");
    expect(await screen.findByRole("heading", { name: text.diagrams.title })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: text.app.nav.main })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: text.app.logout })).toBeInTheDocument();
  });

  it("renders the public view at /s/:token without a login", () => {
    renderRoute("/s/abc");
    expect(screen.getByRole("heading", { name: text.editor.stubPublicView })).toBeInTheDocument();
  });

  it("renders the not-found page for an unknown path", () => {
    renderRoute("/does/not/exist");
    expect(screen.getByRole("heading", { name: text.app.notFoundTitle })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.app.goHome })).toHaveAttribute("href", "/");
  });
});
