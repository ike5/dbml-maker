import "./ui.css";

/**
 * @param {object} props
 * @param {"primary" | "secondary" | "danger" | "ghost"} [props.variant]
 * @param {"md" | "sm"} [props.size]
 * @param {"button" | "submit" | "reset"} [props.type]
 */
export function Button({
  variant = "secondary",
  size = "md",
  type = "button",
  className = "",
  children,
  ...rest
}) {
  return (
    <button type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/**
 * A button with only an icon. The label is necessary: it is the accessible name.
 * @param {object} props
 * @param {string} props.label
 */
export function IconButton({
  label,
  variant = "ghost",
  size = "md",
  className = "",
  children,
  ...rest
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`btn btn-icon btn-${variant} btn-${size} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
