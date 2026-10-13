import { useState } from "react";
import { Button, Dialog, FormError } from "../../ui/index.js";
import { text } from "../../text/en.js";

/**
 * A dialog that asks the user to confirm a risky action.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.body
 * @param {string} props.confirmLabel
 * @param {() => Promise<unknown>} props.onConfirm Throws an ApiError when the request fails.
 * @param {() => void} props.onClose
 */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose }) {
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (caught) {
      setError(caught);
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
          <Button variant="danger" onClick={confirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{body}</p>
      <FormError error={error} />
    </Dialog>
  );
}
