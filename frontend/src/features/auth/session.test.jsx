import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoginPage } from "./LoginPage.jsx";
import { RequireAuth, safeNext } from "./session.jsx";
import { renderRoutes, useLoggedInServer } from "./testUtils.jsx";

const privateRoutes = [
  { path: "/login", element: <p>login route</p> },
  {
    path: "*",
    element: (
      <RequireAuth>
        <p>private</p>
      </RequireAuth>
    ),
  },
];

const loginRoutes = [
  { path: "/login", element: <LoginPage /> },
  { path: "/d/1", element: <p>diagram route</p> },
  { path: "/", element: <p>start route</p> },
];

describe("safeNext", () => {
  it("accepts a path on this site", () => {
    expect(safeNext("/d/1?x=2")).toBe("/d/1?x=2");
  });

  it("refuses an address that can leave this site", () => {
    expect(safeNext("//evil.example.com")).toBe("/");
    expect(safeNext("/\\evil.example.com")).toBe("/");
    expect(safeNext("https://evil.example.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("RequireAuth", () => {
  it("goes to /login with the next parameter when nobody is logged in", async () => {
    const { router } = renderRoutes(privateRoutes, "/d/1?x=2");
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent("/d/1?x=2")}`);
  });

  it("shows the children for a user", async () => {
    useLoggedInServer();
    renderRoutes(privateRoutes, "/");
    expect(await screen.findByText("private")).toBeInTheDocument();
  });
});

describe("LoginPage next", () => {
  it("goes to a safe next parameter for a user who is logged in", async () => {
    useLoggedInServer();
    renderRoutes(loginRoutes, "/login?next=%2Fd%2F1");
    expect(await screen.findByText("diagram route")).toBeInTheDocument();
  });

  it("does not go to an address on a different site", async () => {
    useLoggedInServer();
    renderRoutes(loginRoutes, `/login?next=${encodeURIComponent("//evil.example.com")}`);
    expect(await screen.findByText("start route")).toBeInTheDocument();
  });
});
