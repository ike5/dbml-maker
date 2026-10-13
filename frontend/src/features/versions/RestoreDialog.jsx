import { useState } from "react";
import { restoreVersion } from "../../lib/api/diagrams.js";
import { Button, Dialog, FormError } from "../../ui/index.js";
import { text } from "../../text/en.js";

/**
 * Asks the user to confirm a restore (VER-003).
 * @param {object} props
 * @param {() => number} props.getChangeNumber Called at confirm time, so the number is current.
 * @param {(result: { diagram: object, etag: number }) => void} props.onRestored
 */
export function RestoreDialog({ diagramId, versionId, getChangeNumber, onRestored, onClose }) {
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const result = await restoreVersion(diagramId, versionId, { etag: getChangeNumber() });
      onRestored(result);
    } catch (caught) {
      // The general 412 text offers "keep your version". A restore has no such choice.
      setError(caught?.status === 412 ? { message: text.versions.restoreConflict } : caught);
      setPending(false);
    }
  }

  return (
    <Dialog
      title={text.versions.restoreTitle}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{text.common.cancel}</Button>
          <Button variant="primary" onClick={confirm} disabled={pending}>
            {text.versions.restore}
          </Button>
        </>
      }
    >
      <p>{text.versions.restoreBody}</p>
      <FormError error={error} />
    </Dialog>
  );
}
