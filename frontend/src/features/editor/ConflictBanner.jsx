import { useState } from "react";
import { createVersion, getDiagram } from "../../lib/api/diagrams.js";
import { text } from "../../text/en.js";
import { format } from "../../text/format.js";
import { Banner, Button, FormError } from "../../ui/index.js";
import { keepMyVersion, loadNewVersion } from "./conflict.js";
import { useEditorStore, useEditorStoreApi } from "./store.js";

const personName = (user) => {
  if (!user) return text.editor.conflictUnknownPerson;
  if (typeof user === "string") return user;
  return user.display_name || user.email || text.editor.conflictUnknownPerson;
};

const timeText = (iso) => {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("en") : "";
};

/**
 * Shown after a 412 (DGM-002). The user decides what happens to the local changes.
 * @param {object} props
 * @param {{ flush: () => Promise<void> }} props.autosave
 */
export function ConflictBanner({ autosave }) {
  const store = useEditorStoreApi();
  const conflict = useEditorStore((s) => s.conflict);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Banner
      kind="warning"
      actions={
        <>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => run(() => loadNewVersion({ store, getDiagram }))}
          >
            {text.editor.conflictLoad}
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              run(() =>
                keepMyVersion({
                  store,
                  autosave,
                  createVersion,
                  getDiagram,
                  label: text.editor.conflictVersionLabel,
                }),
              )
            }
          >
            {text.editor.conflictKeep}
          </Button>
        </>
      }
    >
      {format(text.editor.conflictBody, {
        person: personName(conflict?.updated_by),
        time: timeText(conflict?.updated_at),
      })}
      <FormError error={error} />
    </Banner>
  );
}
