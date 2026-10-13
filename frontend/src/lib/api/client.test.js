import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/server.js";
import {
  ApiError,
  apiRequest,
  ensureCsrfCookie,
  getCsrfToken,
  onReleaseMismatch,
  onUnauthorized,
  resetReleaseCheck,
} from "./client.js";

afterEach(() => {
  document.cookie = "csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  resetReleaseCheck();
});

async function catchError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("The request did not fail.");
}

describe("CSRF", () => {
  it("SEC-001 sends X-CSRFToken on a write request", async () => {
    document.cookie = "csrftoken=abc123";
    let header = null;
    server.use(
      http.post("*/api/v1/x", ({ request }) => {
        header = request.headers.get("X-CSRFToken");
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiRequest("POST", "/api/v1/x", { body: { a: 1 } });
    expect(header).toBe("abc123");
    expect(getCsrfToken()).toBe("abc123");
  });

  it("SEC-001 does not send X-CSRFToken on a GET request", async () => {
    document.cookie = "csrftoken=abc123";
    let header = "unset";
    server.use(
      http.get("*/api/v1/x", ({ request }) => {
        header = request.headers.get("X-CSRFToken");
        return HttpResponse.json({});
      }),
    );
    await apiRequest("GET", "/api/v1/x");
    expect(header).toBeNull();
  });

  it("SEC-001 ensureCsrfCookie calls GET /api/v1/csrf", async () => {
    await expect(ensureCsrfCookie()).resolves.toBeUndefined();
  });
});

describe("errors", () => {
  it("reads the error envelope of the API", async () => {
    server.use(
      http.post("*/api/v1/x", () =>
        HttpResponse.json(
          {
            error: {
              code: "validation_failed",
              message: "Bad.",
              fields: { name: ["Type a name."] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    const error = await catchError(apiRequest("POST", "/api/v1/x", { body: {} }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "validation_failed",
      message: "Bad.",
      fields: { name: ["Type a name."] },
    });
  });

  it("reads the error envelope of allauth", async () => {
    server.use(
      http.post("*/_allauth/x", () =>
        HttpResponse.json(
          {
            status: 400,
            errors: [
              { message: "Too short.", code: "password_too_short", param: "password" },
              { message: "Too common.", code: "password_too_common", param: "password" },
            ],
          },
          { status: 400 },
        ),
      ),
    );
    const error = await catchError(apiRequest("POST", "/_allauth/x", { body: {} }));
    expect(error.code).toBe("password_too_short");
    expect(error.fields).toEqual({ password: ["Too short.", "Too common."] });
  });

  it("gives a network_error with status 0", async () => {
    server.use(http.get("*/api/v1/x", () => HttpResponse.error()));
    const error = await catchError(apiRequest("GET", "/api/v1/x"));
    expect(error).toMatchObject({ status: 0, code: "network_error" });
  });

  it("does not throw for a status in allowStatuses", async () => {
    server.use(http.get("*/_allauth/x", () => HttpResponse.json({ a: 1 }, { status: 401 })));
    const result = await apiRequest("GET", "/_allauth/x", { allowStatuses: [401] });
    expect(result.status).toBe(401);
    expect(result.data).toEqual({ a: 1 });
  });

  it("parses no body for 204", async () => {
    server.use(http.delete("*/api/v1/x", () => new HttpResponse(null, { status: 204 })));
    const result = await apiRequest("DELETE", "/api/v1/x");
    expect(result).toMatchObject({ status: 204, data: null });
  });
});

describe("onUnauthorized", () => {
  it("runs for a 401 on /api/", async () => {
    const handler = vi.fn();
    const remove = onUnauthorized(handler);
    server.use(
      http.get("*/api/v1/x", () =>
        HttpResponse.json(
          { error: { code: "not_authenticated", message: "No." } },
          { status: 401 },
        ),
      ),
    );
    await catchError(apiRequest("GET", "/api/v1/x"));
    expect(handler).toHaveBeenCalledTimes(1);
    remove();
  });

  it("does not run for a 401 on /_allauth/", async () => {
    const handler = vi.fn();
    const remove = onUnauthorized(handler);
    server.use(http.get("*/_allauth/x", () => HttpResponse.json({ status: 401 }, { status: 401 })));
    await catchError(apiRequest("GET", "/_allauth/x"));
    expect(handler).not.toHaveBeenCalled();
    remove();
  });

  it("stops after the returned function runs", async () => {
    const handler = vi.fn();
    onUnauthorized(handler)();
    server.use(http.get("*/api/v1/x", () => HttpResponse.json({}, { status: 401 })));
    await catchError(apiRequest("GET", "/api/v1/x"));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("onReleaseMismatch", () => {
  it("runs one time when X-App-Release is different", async () => {
    const handler = vi.fn();
    const remove = onReleaseMismatch(handler);
    server.use(
      http.get("*/api/v1/x", () =>
        HttpResponse.json({}, { headers: { "X-App-Release": "9.9.9" } }),
      ),
    );
    await apiRequest("GET", "/api/v1/x");
    await apiRequest("GET", "/api/v1/x");
    expect(handler).toHaveBeenCalledTimes(1);
    remove();
  });

  it("does not run when the release is the same or the header is not there", async () => {
    const handler = vi.fn();
    const remove = onReleaseMismatch(handler);
    server.use(
      http.get("*/api/v1/same", () =>
        HttpResponse.json({}, { headers: { "X-App-Release": __APP_RELEASE__ } }),
      ),
      http.get("*/api/v1/none", () => HttpResponse.json({})),
    );
    await apiRequest("GET", "/api/v1/same");
    await apiRequest("GET", "/api/v1/none");
    expect(handler).not.toHaveBeenCalled();
    remove();
  });
});
