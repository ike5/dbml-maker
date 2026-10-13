import { text } from "../text/en.js";
import { errorMessage } from "../text/errors.js";
import { CheckIcon, WarningIcon } from "./icons.jsx";
import "./ui.css";

/**
 * A message bar.
 * @param {object} props
 * @param {"info" | "warning" | "error" | "success"} [props.kind]
 * @param {import("react").ReactNode} [props.actions] Buttons at the end of the bar.
 */
export function Banner({ kind = "info", actions, children, className = "" }) {
  const role = kind === "error" || kind === "warning" ? "alert" : "status";
  return (
    <div className={`banner banner-${kind} ${className}`} role={role}>
      {kind === "success" && <CheckIcon />}
      {(kind === "warning" || kind === "error") && <WarningIcon />}
      <div className="banner-body">{children}</div>
      {actions && <div className="banner-actions">{actions}</div>}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} [props.label] Accessible name. The default is "Loading".
 */
export function Spinner({ label = text.common.loading }) {
  return (
    <span className="spinner" role="status">
      <span className="spinner-ring" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {import("react").ReactNode} [props.action]
 */
export function EmptyState({ title, action, children }) {
  return (
    <div className="empty-state">
      <h2 className="empty-state-title">{title}</h2>
      {children && <p className="empty-state-body">{children}</p>}
      {action}
    </div>
  );
}

/**
 * Shows the message of an ApiError. It shows nothing if there is no error.
 * @param {object} props
 * @param {{ code?: string, message?: string } | null | undefined} props.error
 */
export function FormError({ error, className = "" }) {
  if (!error) return null;
  return (
    <p className={`form-error ${className}`} role="alert">
      {errorMessage(error)}
    </p>
  );
}
