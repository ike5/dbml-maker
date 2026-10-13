import { useRef, useState } from "react";
import { text } from "../../text/en.js";
import { EditIcon, IconButton } from "../../ui/index.js";

export const NAME_MAX_LENGTH = 200;

/**
 * The name of the diagram. An editor or an owner can change it in place (DESIGN.md §7.1).
 * The name is React text, so markup in the name stays plain text (EDT-005).
 * @param {object} props
 * @param {string} props.name
 * @param {boolean} props.canEdit
 * @param {(name: string) => void} props.onChange
 */
export function NameEditor({ name, canEdit, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState(null);
  // Escape ends the edit. The blur that follows must not apply the draft.
  const cancelled = useRef(false);

  const validate = (value) => {
    if (value.trim() === "") return text.editor.nameEmpty;
    if (value.length > NAME_MAX_LENGTH) return text.editor.nameTooLong;
    return null;
  };

  const start = () => {
    cancelled.current = false;
    setDraft(name);
    setError(null);
    setEditing(true);
  };

  const apply = () => {
    const problem = validate(draft);
    if (problem) {
      setError(problem);
      return false;
    }
    if (draft !== name) onChange(draft);
    setEditing(false);
    return true;
  };

  if (!editing) {
    return (
      <div className="editor-name-group">
        <h1 className="editor-name">{name}</h1>
        {canEdit && (
          <IconButton label={text.editor.rename} size="sm" onClick={start}>
            <EditIcon />
          </IconButton>
        )}
      </div>
    );
  }

  return (
    <div className="editor-name-group">
      <input
        className="input editor-name-input"
        aria-label={text.editor.nameLabel}
        aria-invalid={error ? true : undefined}
        value={draft}
        autoFocus
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply();
          } else if (event.key === "Escape") {
            cancelled.current = true;
            setEditing(false);
          }
        }}
        onBlur={() => {
          if (cancelled.current) return;
          // A bad draft is lost at blur. The old name stays.
          if (!apply()) setEditing(false);
        }}
      />
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
