import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/server.js";
import {
  changeEmail,
  changePassword,
  getEmailVerification,
  getPasswordReset,
  getSession,
  listEmailAddresses,
  login,
  logout,
  normalizeUser,
  reauthenticate,
  requestPasswordReset,
  resetPassword,
  signup,
  verifyEmail,
} from "./auth.js";

const BASE = "*/_allauth/browser/v1";
const rawUser = { id: 7, display: "Ann", email: "ann@example.com", has_usable_password: true };
const authenticated = {
  status: 200,
  data: { user: rawUser, methods: [{ method: "password" }] },
  meta: { is_authenticated: true },
};
const pendingVerify = {
  status: 401,
  data: { flows: [{ id: "login" }, { id: "verify_email", is_pending: true }] },
  meta: { is_authenticated: false },
};
const noLogin = {
  status: 401,
  data: { flows: [{ id: "login" }] },
  meta: { is_authenticated: false },
};

describe("auth API", () => {
  it("normalizeUser makes the id a string and falls back to the email for display", () => {
    expect(normalizeUser({ id: 7, email: "a@b.c", display: "" })).toEqual({
      id: "7",
      email: "a@b.c",
      display: "a@b.c",
    });
  });

  it("getSession returns the user for 200", async () => {
    server.use(http.get(`${BASE}/auth/session`, () => HttpResponse.json(authenticated)));
    await expect(getSession()).resolves.toEqual({
      id: "7",
      email: "ann@example.com",
      display: "Ann",
    });
  });

  it("getSession returns null for 401 and 410", async () => {
    await expect(getSession()).resolves.toBeNull();
    server.use(
      http.get(`${BASE}/auth/session`, () => HttpResponse.json({ status: 410 }, { status: 410 })),
    );
    await expect(getSession()).resolves.toBeNull();
  });

  it("login returns the user for 200", async () => {
    let body = null;
    server.use(
      http.post(`${BASE}/auth/login`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(authenticated);
      }),
    );
    const result = await login({ email: "ann@example.com", password: "secret-password" });
    expect(body).toEqual({ email: "ann@example.com", password: "secret-password" });
    expect(result).toEqual({
      status: "ok",
      user: { id: "7", email: "ann@example.com", display: "Ann" },
    });
  });

  it("AUTH-002 login returns verify_email for a 401 with a pending verify_email flow", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () => HttpResponse.json(pendingVerify, { status: 401 })),
    );
    await expect(login({ email: "a@b.c", password: "x" })).resolves.toEqual({
      status: "verify_email",
    });
  });

  it("login throws for a 401 without a pending flow", async () => {
    server.use(http.post(`${BASE}/auth/login`, () => HttpResponse.json(noLogin, { status: 401 })));
    await expect(login({ email: "a@b.c", password: "x" })).rejects.toMatchObject({ status: 401 });
  });

  it("login throws an ApiError with fields for 400", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(
          { status: 400, errors: [{ code: "invalid", param: "email", message: "Not valid." }] },
          { status: 400 },
        ),
      ),
    );
    await expect(login({ email: "x", password: "x" })).rejects.toMatchObject({
      status: 400,
      fields: { email: ["Not valid."] },
    });
  });

  it("AUTH-001 signup returns verify_email for a 401 with a pending flow", async () => {
    server.use(
      http.post(`${BASE}/auth/signup`, () => HttpResponse.json(pendingVerify, { status: 401 })),
    );
    await expect(signup({ email: "a@b.c", password: "long-password" })).resolves.toEqual({
      status: "verify_email",
    });
  });

  it("signup returns the user for 200", async () => {
    server.use(http.post(`${BASE}/auth/signup`, () => HttpResponse.json(authenticated)));
    const result = await signup({ email: "a@b.c", password: "long-password" });
    expect(result.status).toBe("ok");
  });

  it("AUTH-006 signup throws for 403", async () => {
    server.use(
      http.post(`${BASE}/auth/signup`, () => HttpResponse.json({ status: 403 }, { status: 403 })),
    );
    await expect(signup({ email: "a@b.c", password: "x" })).rejects.toMatchObject({ status: 403 });
  });

  it("logout accepts the 401 of allauth", async () => {
    server.use(
      http.delete(`${BASE}/auth/session`, () => HttpResponse.json(noLogin, { status: 401 })),
    );
    await expect(logout()).resolves.toBeUndefined();
  });

  it("getEmailVerification sends the key in the header", async () => {
    let key = null;
    server.use(
      http.get(`${BASE}/auth/email/verify`, ({ request }) => {
        key = request.headers.get("X-Email-Verification-Key");
        return HttpResponse.json({
          status: 200,
          data: { email: "ann@example.com", user: rawUser },
          meta: { is_authenticating: false },
        });
      }),
    );
    await expect(getEmailVerification("k1")).resolves.toEqual({ email: "ann@example.com" });
    expect(key).toBe("k1");
  });

  it("verifyEmail returns the user for 200 and login_required for 401", async () => {
    server.use(http.post(`${BASE}/auth/email/verify`, () => HttpResponse.json(authenticated)));
    await expect(verifyEmail("k1")).resolves.toMatchObject({ status: "ok" });
    server.use(
      http.post(`${BASE}/auth/email/verify`, () => HttpResponse.json(noLogin, { status: 401 })),
    );
    await expect(verifyEmail("k1")).resolves.toEqual({ status: "login_required" });
  });

  it("verifyEmail throws for a key that is not correct", async () => {
    server.use(
      http.post(`${BASE}/auth/email/verify`, () =>
        HttpResponse.json(
          { status: 400, errors: [{ code: "invalid", param: "key", message: "Bad key." }] },
          { status: 400 },
        ),
      ),
    );
    await expect(verifyEmail("bad")).rejects.toMatchObject({ status: 400 });
  });

  it("AUTH-003 requestPasswordReset sends the email address", async () => {
    let body = null;
    server.use(
      http.post(`${BASE}/auth/password/request`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ status: 200 });
      }),
    );
    await requestPasswordReset("ann@example.com");
    expect(body).toEqual({ email: "ann@example.com" });
  });

  it("getPasswordReset sends the key in the header", async () => {
    let key = null;
    server.use(
      http.get(`${BASE}/auth/password/reset`, ({ request }) => {
        key = request.headers.get("X-Password-Reset-Key");
        return HttpResponse.json({ status: 200, data: { user: rawUser } });
      }),
    );
    await getPasswordReset("r1");
    expect(key).toBe("r1");
  });

  it("AUTH-004 resetPassword returns ok for 200 and login_required for 401", async () => {
    let body = null;
    server.use(
      http.post(`${BASE}/auth/password/reset`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(noLogin, { status: 401 });
      }),
    );
    await expect(resetPassword({ key: "r1", password: "new-long-password" })).resolves.toEqual({
      status: "login_required",
    });
    expect(body).toEqual({ key: "r1", password: "new-long-password" });
    server.use(http.post(`${BASE}/auth/password/reset`, () => HttpResponse.json(authenticated)));
    await expect(resetPassword({ key: "r1", password: "x" })).resolves.toMatchObject({
      status: "ok",
    });
  });

  it("changePassword sends the snake_case body", async () => {
    let body = null;
    server.use(
      http.post(`${BASE}/account/password/change`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ status: 200 });
      }),
    );
    await changePassword({ currentPassword: "old", newPassword: "new-long-password" });
    expect(body).toEqual({ current_password: "old", new_password: "new-long-password" });
  });

  it("listEmailAddresses and changeEmail return the list of addresses", async () => {
    const addresses = [{ email: "ann@example.com", primary: true, verified: true }];
    server.use(
      http.get(`${BASE}/account/email`, () => HttpResponse.json({ status: 200, data: addresses })),
      http.post(`${BASE}/account/email`, () => HttpResponse.json({ status: 200, data: addresses })),
    );
    await expect(listEmailAddresses()).resolves.toEqual(addresses);
    await expect(changeEmail("new@example.com")).resolves.toEqual(addresses);
  });

  it("reauthenticate sends the password and throws for 400", async () => {
    server.use(http.post(`${BASE}/auth/reauthenticate`, () => HttpResponse.json(authenticated)));
    await expect(reauthenticate("secret")).resolves.toBeUndefined();
    server.use(
      http.post(`${BASE}/auth/reauthenticate`, () =>
        HttpResponse.json(
          {
            status: 400,
            errors: [{ code: "incorrect_password", param: "password", message: "Wrong." }],
          },
          { status: 400 },
        ),
      ),
    );
    await expect(reauthenticate("bad")).rejects.toMatchObject({
      status: 400,
      fields: { password: ["Wrong."] },
    });
  });
});
