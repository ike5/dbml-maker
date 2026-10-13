import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../test/server.js";
import { text } from "../../text/en.js";
import { format } from "../../text/format.js";
import { LoginPage } from "./LoginPage.jsx";
import { ResetPasswordPage } from "./ResetPasswordPage.jsx";
import { ResetPasswordRequestPage } from "./ResetPasswordRequestPage.jsx";
import { SettingsPage } from "./SettingsPage.jsx";
import { SignupPage } from "./SignupPage.jsx";
import { VerifyEmailPage } from "./VerifyEmailPage.jsx";
import {
  BASE,
  authenticated,
  noLogin,
  pendingVerify,
  renderRoutes,
  useLoggedInServer,
} from "./testUtils.jsx";

const t = text.auth;
const PASSWORD = "a-long-password-1";

async function fillLogin(user, email = "ann@example.com") {
  await user.type(await screen.findByLabelText(t.email), email);
  await user.type(screen.getByLabelText(t.password), PASSWORD);
  await user.click(screen.getByRole("button", { name: t.login.submit }));
}

describe("auth requirements", () => {
  it("AUTH-001 sign-up shows the message to open the verification email", async () => {
    server.use(
      http.post(`${BASE}/auth/signup`, () => HttpResponse.json(pendingVerify, { status: 401 })),
    );
    const user = userEvent.setup();
    renderRoutes([{ path: "/signup", element: <SignupPage /> }], "/signup");
    await user.type(screen.getByLabelText(t.email), "new@example.com");
    await user.type(screen.getByLabelText(t.password), PASSWORD);
    await user.click(screen.getByRole("button", { name: t.signup.submit }));
    expect(await screen.findByText(t.signup.sent)).toBeInTheDocument();
  });

  it("AUTH-002 login of a user who did not verify the address shows the verification message", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () => HttpResponse.json(pendingVerify, { status: 401 })),
    );
    const user = userEvent.setup();
    renderRoutes([{ path: "/login", element: <LoginPage /> }], "/login");
    await fillLogin(user);
    expect(await screen.findByText(t.login.unverified)).toBeInTheDocument();
  });

  it("AUTH-003 the password reset request shows the same message for each address", async () => {
    server.use(
      http.post(`${BASE}/auth/password/request`, () => HttpResponse.json({ status: 200 })),
    );
    for (const address of ["known@example.com", "unknown@example.com"]) {
      const user = userEvent.setup();
      const { unmount } = renderRoutes(
        [{ path: "/reset-password", element: <ResetPasswordRequestPage /> }],
        "/reset-password",
      );
      await user.type(screen.getByLabelText(t.email), address);
      await user.click(screen.getByRole("button", { name: t.resetRequest.submit }));
      expect(await screen.findByText(t.resetRequest.sent)).toBeInTheDocument();
      unmount();
    }
  });

  it("AUTH-004 the reset page sets the new password with the key from the email", async () => {
    let body = null;
    let headerKey = null;
    server.use(
      http.get(`${BASE}/auth/password/reset`, ({ request }) => {
        headerKey = request.headers.get("X-Password-Reset-Key");
        return HttpResponse.json({ status: 200, data: { user: authenticated.data.user } });
      }),
      http.post(`${BASE}/auth/password/reset`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(noLogin, { status: 401 });
      }),
    );
    const user = userEvent.setup();
    const { router } = renderRoutes(
      [
        { path: "/reset-password/:key", element: <ResetPasswordPage /> },
        { path: "/login", element: <LoginPage /> },
      ],
      "/reset-password/abc-123",
    );
    await user.type(await screen.findByLabelText(t.newPassword), PASSWORD);
    await user.click(screen.getByRole("button", { name: t.reset.submit }));
    expect(await screen.findByText(t.login.resetDone)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(headerKey).toBe("abc-123");
    expect(body).toEqual({ key: "abc-123", password: PASSWORD });
  });

  it("AUTH-005 account delete asks for the password, deletes the account, and logs out", async () => {
    useLoggedInServer();
    const calls = [];
    server.use(
      http.post(`${BASE}/auth/reauthenticate`, async ({ request }) => {
        calls.push(["reauthenticate", await request.json()]);
        return HttpResponse.json(authenticated);
      }),
      http.delete("*/api/v1/accounts/me", () => {
        calls.push(["delete"]);
        // The backend ends the session, so the next session read gives 401.
        server.use(
          http.get(`${BASE}/auth/session`, () => HttpResponse.json(noLogin, { status: 401 })),
        );
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    const { router, queryClient } = renderRoutes(
      [
        { path: "/settings", element: <SettingsPage /> },
        { path: "/login", element: <LoginPage /> },
      ],
      "/settings",
    );
    await user.click(await screen.findByRole("button", { name: t.settings.deleteOpen }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(t.settings.deleteDialogBody)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(t.password), PASSWORD);
    await user.click(within(dialog).getByRole("button", { name: t.settings.deleteConfirm }));
    expect(await screen.findByText(t.login.accountDeleted)).toBeInTheDocument();
    expect(calls).toEqual([["reauthenticate", { password: PASSWORD }], ["delete"]]);
    expect(router.state.location.pathname).toBe("/login");
    expect(queryClient.getQueryData(["session"])).toBeNull();
  });

  it("AUTH-006 closed sign-up shows that sign-up is closed", async () => {
    server.use(
      http.post(`${BASE}/auth/signup`, () => HttpResponse.json({ status: 403 }, { status: 403 })),
    );
    const user = userEvent.setup();
    renderRoutes([{ path: "/signup", element: <SignupPage /> }], "/signup");
    await user.type(screen.getByLabelText(t.email), "new@example.com");
    await user.type(screen.getByLabelText(t.password), PASSWORD);
    await user.click(screen.getByRole("button", { name: t.signup.submit }));
    expect(await screen.findByText(t.signup.closed)).toBeInTheDocument();
  });
});

describe("auth pages", () => {
  it("login with a next parameter goes to the next page", async () => {
    server.use(http.post(`${BASE}/auth/login`, () => HttpResponse.json(authenticated)));
    const user = userEvent.setup();
    const { router } = renderRoutes(
      [
        { path: "/login", element: <LoginPage /> },
        { path: "/d/1", element: <p>diagram route</p> },
      ],
      "/login?next=%2Fd%2F1",
    );
    await fillLogin(user);
    expect(await screen.findByText("diagram route")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/d/1");
  });

  it("login shows the error of allauth at the form", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(
          {
            status: 400,
            errors: [{ code: "email_password_mismatch", message: "Email or password is wrong." }],
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderRoutes([{ path: "/login", element: <LoginPage /> }], "/login");
    await fillLogin(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is wrong.");
  });

  it("verify page starts a session and goes to the start page", async () => {
    let verifyBody = null;
    server.use(
      http.get(`${BASE}/auth/email/verify`, () =>
        HttpResponse.json({
          status: 200,
          data: { email: "ann@example.com", user: authenticated.data.user },
          meta: { is_authenticating: false },
        }),
      ),
      http.post(`${BASE}/auth/email/verify`, async ({ request }) => {
        verifyBody = await request.json();
        return HttpResponse.json(authenticated);
      }),
    );
    const { router, queryClient } = renderRoutes(
      [
        { path: "/verify-email/:key", element: <VerifyEmailPage /> },
        { path: "/", element: <p>start route</p> },
      ],
      "/verify-email/key-1",
    );
    expect(await screen.findByText("start route")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(verifyBody).toEqual({ key: "key-1" });
    expect(queryClient.getQueryData(["session"])).toMatchObject({ email: "ann@example.com" });
  });

  it("verify page shows a message and a login link for a key that is not correct", async () => {
    server.use(
      http.get(`${BASE}/auth/email/verify`, () =>
        HttpResponse.json(
          { status: 400, errors: [{ code: "invalid", param: "key", message: "Bad key." }] },
          { status: 400 },
        ),
      ),
    );
    renderRoutes([{ path: "/verify-email/:key", element: <VerifyEmailPage /> }], "/verify-email/x");
    expect(await screen.findByText(text.auth.verify.invalid)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.auth.verify.toLogin })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("reset page shows a link to a new request for a key that is not correct", async () => {
    server.use(
      http.get(`${BASE}/auth/password/reset`, () =>
        HttpResponse.json(
          { status: 400, errors: [{ code: "invalid", param: "key", message: "Bad key." }] },
          { status: 400 },
        ),
      ),
    );
    renderRoutes(
      [{ path: "/reset-password/:key", element: <ResetPasswordPage /> }],
      "/reset-password/x",
    );
    expect(await screen.findByText(text.auth.reset.invalid)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: text.auth.reset.toRequest })).toBeInTheDocument();
  });

  it("settings shows the email address and sends the change of the address", async () => {
    useLoggedInServer();
    let body = null;
    server.use(
      http.post(`${BASE}/account/email`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ status: 200, data: [] });
      }),
    );
    const user = userEvent.setup();
    renderRoutes([{ path: "/settings", element: <SettingsPage /> }], "/settings");
    expect(
      await screen.findByText(format(t.settings.currentEmail, { email: "ann@example.com" })),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.settings.newEmail), "new@example.com");
    await user.click(screen.getByRole("button", { name: t.settings.emailSubmit }));
    expect(
      await screen.findByText(format(t.settings.emailSent, { email: "new@example.com" })),
    ).toBeInTheDocument();
    expect(body).toEqual({ email: "new@example.com" });
  });

  it("settings sends the change of the password and shows the field error", async () => {
    useLoggedInServer();
    let attempt = 0;
    server.use(
      http.post(`${BASE}/account/password/change`, () => {
        attempt += 1;
        if (attempt === 1) {
          return HttpResponse.json(
            {
              status: 400,
              errors: [{ code: "too_short", param: "new_password", message: "Too short." }],
            },
            { status: 400 },
          );
        }
        return HttpResponse.json({ status: 200 });
      }),
    );
    const user = userEvent.setup();
    renderRoutes([{ path: "/settings", element: <SettingsPage /> }], "/settings");
    await user.type(await screen.findByLabelText(t.currentPassword), "old-password-1");
    await user.type(screen.getByLabelText(t.newPassword), PASSWORD);
    await user.click(screen.getByRole("button", { name: t.settings.passwordSubmit }));
    expect(await screen.findByText("Too short.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: t.settings.passwordSubmit }));
    await waitFor(() => expect(screen.getByText(t.settings.passwordChanged)).toBeInTheDocument());
  });

  it("settings shows the error for a password that is not correct in the delete dialog", async () => {
    useLoggedInServer();
    server.use(
      http.post(`${BASE}/auth/reauthenticate`, () =>
        HttpResponse.json(
          {
            status: 400,
            errors: [{ code: "incorrect_password", param: "password", message: "Wrong password." }],
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderRoutes([{ path: "/settings", element: <SettingsPage /> }], "/settings");
    await user.click(await screen.findByRole("button", { name: t.settings.deleteOpen }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(t.password), "bad");
    await user.click(within(dialog).getByRole("button", { name: t.settings.deleteConfirm }));
    expect(await within(dialog).findByText("Wrong password.")).toBeInTheDocument();
  });
});
