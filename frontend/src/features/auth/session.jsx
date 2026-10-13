import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate } from "react-router";
import { getSession, logout } from "../../lib/api/auth.js";
import { Spinner } from "../../ui/index.js";

export const SESSION_KEY = ["session"];

/**
 * The session of the user (DESIGN.md §12.5).
 * @returns {{ user: import("../../lib/api/auth.js").User | null | undefined, isLoading: boolean }}
 */
export function useSession() {
  const { data, isLoading } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: getSession,
    retry: false,
  });
  return { user: data, isLoading };
}

/**
 * Give a function that ends the session in the SPA. It clears the data of the
 * user, so that the next user cannot see it.
 */
export function useEndSession() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.setQueryData(SESSION_KEY, null);
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
  };
}

/** @returns {() => Promise<void>} A function that logs the user out and goes to /login. */
export function useLogout() {
  const endSession = useEndSession();
  const navigate = useNavigate();
  return async () => {
    await logout();
    endSession();
    navigate("/login");
  };
}

/**
 * Accept a "next" address only if it is a path on this site. A value that
 * starts with "//" or "/\" can send the user to a different site.
 * @param {string | null | undefined} next
 * @returns {string}
 */
export function safeNext(next) {
  if (typeof next === "string" && next.startsWith("/") && !/^\/[/\\]/.test(next)) return next;
  return "/";
}

/** Show the children only for a logged-in user (DESIGN.md §12.5). */
export function RequireAuth({ children }) {
  const { user, isLoading } = useSession();
  const location = useLocation();
  if (isLoading) return <Spinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return children;
}
