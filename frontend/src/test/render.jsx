import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

/** A QueryClient without retries, so that a failed request fails the test at once. */
export function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

/**
 * Render a component in a QueryClient and a memory router.
 * @param {import("react").ReactElement} ui
 * @param {{ route?: string, path?: string, queryClient?: QueryClient }} [options]
 *   route: the URL of the test. path: the route pattern for ui, for example "/d/:diagramId".
 * @returns The result of render, and queryClient and router.
 */
export function renderWithProviders(
  ui,
  { route = "/", path = "*", queryClient = makeTestQueryClient() } = {},
) {
  const router = createMemoryRouter([{ path, element: ui }], { initialEntries: [route] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, queryClient, router };
}
