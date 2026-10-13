import { useId, useState } from "react";
import { Button, Dialog, FormError, TextField } from "../../ui/index.js";
import { text } from "../../text/en.js";

// The server limit for the name of a diagram (DESIGN.md §7.1, DGM-005).
const MAX_NAME_LENGTH = 200;

/**
 * A dialog with one name field. It makes a diagram or renames a diagram.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.initialName
 * @param {string} props.submitLabel
 * @param {(name: string) => Promise<unknown>} props.onSubmit Throws an ApiError when the request fails.
 * @param {() => void} props.onClose
 */
export function NameDialog({ title, initialName, submitLabel, onSubmit, onClose }) {
  const formId = useId();
  const [name, setName] = useState(initialName);
  const [fieldError, setFieldError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    setApiError(null);
    if (!trimmed) return setFieldError(text.diagrams.nameEmpty);
    if (trimmed.length > MAX_NAME_LENGTH) return setFieldError(text.diagrams.nameTooLong);
    setFieldError(null);
    setPending(true);
    try {
      await onSubmit(trimmed);
    } catch (error) {
      if (error?.fields?.name) setFieldError(error.fields.name.join(" "));
      else setApiError(error);
      setPending(false);
    }
  }

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{text.common.cancel}</Button>
          <Button type="submit" form={formId} variant="primary" disabled={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <TextField
          label={text.diagrams.nameLabel}
          value={name}
          error={fieldError}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
        <FormError error={apiError} />
      </form>
    </Dialog>
  );
}
