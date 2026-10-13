import { Component } from "react";
import { useRouteError } from "react-router";
import { text } from "../text/en.js";
import { EmptyState } from "../ui/index.js";

function ErrorContent() {
  return (
    <div className="centered-layout">
      {/* A plain link loads the page again. It works outside the router and after an error. */}
      <EmptyState title={text.app.errorTitle} action={<a href="/">{text.app.goHome}</a>}>
        {text.app.errorBody}
      </EmptyState>
    </div>
  );
}

/** The errorElement of the root route. It catches errors in route rendering and loading. */
export function RouteErrorElement() {
  const error = useRouteError();
  // The error stays in the console for a developer. The page shows only STE text.
  console.error(error);
  return <ErrorContent />;
}

/** Catches a render error outside the router. */
export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.failed) return <ErrorContent />;
    return this.props.children;
  }
}
