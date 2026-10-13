import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { ErrorBoundary } from "./app/ErrorBoundary.jsx";
import { queryClient } from "./app/queryClient.js";
import { createRouter } from "./app/router.jsx";
import { ensureCsrfCookie, onUnauthorized } from "./lib/api/client.js";
import "./styles/global.css";

// A 401 from the API means the session ended. RequireAuth then goes to /login (DESIGN.md §12.5).
onUnauthorized(() => queryClient.setQueryData(["session"], null));

// The first render does not wait for the cookie. A failure here is not fatal:
// the first write request fails with a clear error, and the user can try again.
ensureCsrfCookie().catch(() => {});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={createRouter()} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
