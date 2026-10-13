import { Link, NavLink, Outlet } from "react-router";
import { useLogout, useSession } from "../features/auth/index.js";
import { Button } from "../ui/index.js";
import { text } from "../text/en.js";

/** The header and the main area for the pages that need a login. */
export function AppShell() {
  const { user } = useSession();
  const logout = useLogout();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-brand">
          {text.app.name}
        </Link>
        <nav className="app-nav" aria-label={text.app.nav.main}>
          <NavLink to="/" end className="app-nav-link">
            {text.app.nav.diagrams}
          </NavLink>
          <NavLink to="/trash" className="app-nav-link">
            {text.app.nav.trash}
          </NavLink>
          <NavLink to="/settings" className="app-nav-link">
            {text.app.nav.settings}
          </NavLink>
        </nav>
        <div className="app-user">
          {user && <span>{user.email}</span>}
          <Button size="sm" onClick={() => logout()}>
            {text.app.logout}
          </Button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
