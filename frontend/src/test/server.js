import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// Default answers for the requests that each page makes at start.
// A test adds its own handlers with server.use(...).
export const defaultHandlers = [
  http.get("*/api/v1/csrf", () => new HttpResponse(null, { status: 204 })),
  http.get("*/_allauth/browser/v1/auth/session", () =>
    HttpResponse.json(
      { status: 401, data: { flows: [] }, meta: { is_authenticated: false } },
      { status: 401 },
    ),
  ),
];

export const server = setupServer(...defaultHandlers);
