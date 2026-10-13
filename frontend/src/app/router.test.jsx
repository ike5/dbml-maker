import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { text } from "../text/en.js";
import { makeTestQueryClient } from "../test/render.jsx";
import { createTestRouter } from "./router.jsx";

function renderRoute(url) {
  return render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <RouterProvider router={createTestRouter([url])} />
    </QueryClientProvider>,
  );
}

describe("router", () => {
  it("renders the login page at /login without the app header", () => {
    renderRoute("/login");
    expect(screen.getByRole("heading", { name: text.auth.stubLogin })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders the diagram list in the app shell at /", () => {
    renderRoute("/");
    expect(screen.getByRole("heading", { name: text.diagrams.stubList })).toBeInTheDocument();
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
