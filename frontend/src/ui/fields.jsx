import { useId } from "react";
import "./ui.css";

// A field gets its id from the caller, or from useId. The error and the hint
// connect to the control with aria-describedby.
function Field({ label, error, hint, id, children }) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={controlId} className="field-label">
        {label}
      </label>
      {children({
        id: controlId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} [props.error]
 * @param {string} [props.hint]
 */
export function TextField({ label, error, hint, id, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      {(aria) => <input className="input" {...aria} {...rest} />}
    </Field>
  );
}

export function TextArea({ label, error, hint, id, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      {(aria) => <textarea className="input" rows={4} {...aria} {...rest} />}
    </Field>
  );
}

/**
 * @param {object} props
 * @param {{ value: string, label: string }[]} props.options
 */
export function Select({ label, error, hint, id, options, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} id={id}>
      {(aria) => (
        <select className="input" {...aria} {...rest}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function Checkbox({ label, id, ...rest }) {
  const generated = useId();
  const controlId = id ?? generated;
  return (
    <div className="checkbox">
      <input type="checkbox" id={controlId} {...rest} />
      <label htmlFor={controlId}>{label}</label>
    </div>
  );
}
