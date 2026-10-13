// Test data and helpers for the tests of this feature.
import { vi } from "vitest";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "../../test/render.jsx";
import { server } from "../../test/server.js";
import { VersionPanel } from "./index.js";

export function version(overrides = {}) {
  return {
    id: "v1",
    kind: "named",
    label: "Before launch",
    change_number: 4,
    created_at: "2026-03-01T10:30:00Z",
    created_by: { id: "u1", email: "ann@example.com", display_name: "Ann" },
    ...overrides,
  };
}

export function listHandler(pages) {
  return http.get("*/api/v1/diagrams/d1/versions", ({ request }) => {
    const cursor = new URL(request.url).searchParams.get("cursor");
    return HttpResponse.json(pages[cursor ?? "first"]);
  });
}

export function renderPanel(props = {}) {
  const handlers = {
    onClose: vi.fn(),
    onRestored: vi.fn(),
    getChangeNumber: vi.fn(() => 7),
  };
  const result = renderWithProviders(
    <VersionPanel diagramId="d1" canEdit {...handlers} {...props} />,
  );
  return { ...result, ...handlers };
}

export { server };
