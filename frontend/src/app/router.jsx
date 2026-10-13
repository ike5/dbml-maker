import { lazy, Suspense } from "react";
import { createBrowserRouter, createMemoryRouter, Link, Outlet } from "react-router";
import {
  LoginPage,
  RequireAuth,
  ResetPasswordPage,
  ResetPasswordRequestPage,
  SettingsPage,
  SignupPage,
  VerifyEmailPage,
} from "../features/auth/index.js";
import { DiagramListPage, TrashPage } from "../features/diagrams/index.js";
import { text } from "../text/en.js";
import { EmptyState, Spinner } from "../ui/index.js";
import { AppShell } from "./AppShell.jsx";
import { RouteErrorElement } from "./ErrorBoundary.jsx";
import { ReleaseBanner } from "./ReleaseBanner.jsx";

// The editor pages contain CodeMirror and React Flow. Load them only when a route needs them.
const EditorPageLazy = lazy(() =>
  import("../features/editor/index.js").then((m) => ({ default: m.EditorPage })),
);
const PublicViewPageLazy = lazy(() =>
  import("../features/editor/index.js").then((m) => ({ default: m.PublicViewPage })),
);

function LazyPage({ children }) {
  return (
    <Suspense
      fallback={
        <div className="centered-layout">
          <Spinner />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function Root() {
  return (
    <div className="app-root">
      <ReleaseBanner />
      <Outlet />
    </div>
  );
}

// Auth pages have no header, so they share a simple centered layout.
function CenteredLayout() {
  return (
    <div className="centered-layout">
      <div className="centered-card">
        <Outlet />
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="centered-layout">
      <EmptyState title={text.app.notFoundTitle} action={<Link to="/">{text.app.goHome}</Link>}>
        {text.app.notFoundBody}
      </EmptyState>
    </div>
  );
}

// The routes of DESIGN.md §12.4. The feature agents must not change them.
export const routes = [
  {
    element: <Root />,
    errorElement: <RouteErrorElement />,
    children: [
      {
        element: <CenteredLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/signup", element: <SignupPage /> },
          { path: "/verify-email/:key", element: <VerifyEmailPage /> },
          { path: "/reset-password", element: <ResetPasswordRequestPage /> },
          { path: "/reset-password/:key", element: <ResetPasswordPage /> },
        ],
      },
      {
        path: "/s/:token",
        element: (
          <LazyPage>
            <PublicViewPageLazy />
          </LazyPage>
        ),
      },
      {
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { path: "/", element: <DiagramListPage /> },
          { path: "/trash", element: <TrashPage /> },
          { path: "/settings", element: <SettingsPage /> },
          {
            path: "/d/:diagramId",
            element: (
              <LazyPage>
                <EditorPageLazy />
              </LazyPage>
            ),
          },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);

/** For tests. */
export const createTestRouter = (initialEntries) => createMemoryRouter(routes, { initialEntries });
