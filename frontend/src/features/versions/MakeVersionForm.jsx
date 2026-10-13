import { useState } from "react";
import { Button, FormError, TextField } from "../../ui/index.js";
import { text } from "../../text/en.js";

// The server limit for the label of a version (DESIGN.md §7.11).
const MAX_LABEL_LENGTH = 200;

/**
 * The form that makes a named version (VER-001).
 * @param {object} props
 * @param {(label: string) => Promise<unknown>} props.onSubmit Throws an ApiError when the request fails.
 * @param {() => void} props.onEdit Called when the user changes the field.
 */
export function MakeVersionForm({ onSubmit, onEdit }) {
  const [label, setLabel] = useState("");
  const [fieldError, setFieldError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const trimmed = label.trim();
    setApiError(null);
    if (!trimmed) return setFieldError(text.versions.labelEmpty);
    if (trimmed.length > MAX_LABEL_LENGTH) return setFieldError(text.versions.labelTooLong);
    setFieldError(null);
    setPending(true);
    try {
      await onSubmit(trimmed);
      setLabel("");
    } catch (error) {
      if (error?.fields?.label) setFieldError(error.fields.label.join(" "));
      else setApiError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="version-make" onSubmit={submit} noValidate>
      <h3>{text.versions.makeHeading}</h3>
      <TextField
        label={text.versions.labelLabel}
        value={label}
        error={fieldError}
        onChange={(event) => {
          setLabel(event.target.value);
          onEdit();
        }}
        autoComplete="off"
      />
      <FormError error={apiError} />
      <Button type="submit" variant="primary" disabled={pending}>
        {text.versions.make}
      </Button>
    </form>
  );
}
