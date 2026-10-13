import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router";
import { makeTestQueryClient } from "../../test/render.jsx";
import { server } from "../../test/server.js";

export const BASE = "*/_allauth/browser/v1";

export const authenticated = {
  status: 200,
  data: { user: { id: 1, email: "ann@example.com", display: "Ann" }, methods: [] },
  meta: { is_authenticated: true },
};

export const pendingVerify = {
  status: 401,
  data: { flows: [{ id: "login" }, { id: "verify_email", is_pending: true }] },
  meta: { is_authenticated: false },
};

export const noLogin = {
  status: 401,
  data: { flows: [{ id: "login" }] },
  meta: { is_authenticated: false },
};

/** Make the session endpoint answer with a logged-in user. */
export function useLoggedInServer() {
  server.use(http.get(`${BASE}/auth/session`, () => HttpResponse.json(authenticated)));
}

/**
 * Render several routes, so that a redirect of a page goes to a real route.
 * @param {import("react-router").RouteObject[]} routes
 * @param {string} route The start URL.
 */
export function renderRoutes(routes, route) {
  const queryClient = makeTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, queryClient, router };
}
