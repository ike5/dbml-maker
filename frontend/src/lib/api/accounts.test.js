import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/server.js";
import { deleteAccount } from "./accounts.js";
import { onUnauthorized } from "./client.js";

describe("accounts API", () => {
  let removeHandler = null;
  afterEach(() => removeHandler?.());

  it("AUTH-005 deleteAccount sends DELETE and accepts 204", async () => {
    let method = null;
    server.use(
      http.delete("*/api/v1/accounts/me", ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await expect(deleteAccount()).resolves.toBeUndefined();
    expect(method).toBe("DELETE");
  });

  it("AUTH-005 a 401 with reauthentication_required throws and does not call the 401 handler", async () => {
    const handler = vi.fn();
    removeHandler = onUnauthorized(handler);
    server.use(
      http.delete("*/api/v1/accounts/me", () =>
        HttpResponse.json(
          { error: { code: "reauthentication_required", message: "Authenticate again." } },
          { status: 401 },
        ),
      ),
    );
    await expect(deleteAccount()).rejects.toMatchObject({
      status: 401,
      code: "reauthentication_required",
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
