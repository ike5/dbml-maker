import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { duplicateDiagram } from "../../lib/api/diagrams.js";
import { text } from "../../text/en.js";
import {
  ArrangeIcon,
  Button,
  CopyIcon,
  DownloadIcon,
  FitIcon,
  FormError,
  HistoryIcon,
  IconButton,
  ShareIcon,
} from "../../ui/index.js";
import { NameEditor } from "./NameEditor.jsx";
import { useEditorStore } from "./store.js";

const STATUS_TEXT = {
  saved: text.editor.statusSaved,
  saving: text.editor.statusSaving,
  dirty: text.editor.statusDirty,
  error: text.editor.statusDirty,
  conflict: text.editor.statusDirty,
};

/** The save status. The region is live, so a screen reader says each change. */
function SaveStatus({ autosave }) {
  const saveState = useEditorStore((s) => s.saveState);
  return (
    <div className="editor-status" aria-live="polite" aria-label={text.editor.saveStatusLabel}>
      <span>{STATUS_TEXT[saveState]}</span>
      {saveState === "error" && (
        <Button size="sm" onClick={() => autosave.flush()}>
          {text.editor.retry}
        </Button>
      )}
    </div>
  );
}

/**
 * The toolbar of the editor page (DESIGN.md §12.6).
 * @param {object} props
 * @param {import("react").RefObject<any>} props.canvasRef
 * @param {{ flush: () => Promise<void> }} props.autosave
 * @param {boolean} props.versionsOpen
 * @param {() => void} props.onToggleVersions
 * @param {() => void} props.onShare
 * @param {() => void} props.onExport
 */
export function EditorToolbar({
  canvasRef,
  autosave,
  versionsOpen,
  onToggleVersions,
  onShare,
  onExport,
}) {
  const role = useEditorStore((s) => s.role);
  const name = useEditorStore((s) => s.name);
  const diagramId = useEditorStore((s) => s.diagramId);
  const setName = useEditorStore((s) => s.setName);
  const canEdit = role === "owner" || role === "editor";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [duplicateError, setDuplicateError] = useState(null);

  async function duplicate() {
    setDuplicateError(null);
    try {
      const { diagram } = await duplicateDiagram(diagramId);
      await queryClient.invalidateQueries({ queryKey: ["diagrams"] });
      navigate(`/d/${diagram.id}`);
    } catch (error) {
      setDuplicateError(error);
    }
  }

  return (
    <div className="editor-toolbar" role="toolbar" aria-label={text.editor.toolbarLabel}>
      <Link to="/" className="editor-back">
        {text.editor.backToList}
      </Link>
      <NameEditor name={name} canEdit={canEdit} onChange={setName} />
      {canEdit ? <SaveStatus autosave={autosave} /> : <p>{text.editor.viewerNote}</p>}
      <div className="editor-toolbar-actions">
        {canEdit && (
          <IconButton label={text.editor.arrange} onClick={() => canvasRef.current?.arrange()}>
            <ArrangeIcon />
          </IconButton>
        )}
        <IconButton label={text.editor.fit} onClick={() => canvasRef.current?.fitView()}>
          <FitIcon />
        </IconButton>
        <Button size="sm" aria-pressed={versionsOpen} onClick={onToggleVersions}>
          <HistoryIcon size={16} />
          {text.editor.versions}
        </Button>
        {role === "owner" && (
          <Button size="sm" onClick={onShare}>
            <ShareIcon size={16} />
            {text.editor.share}
          </Button>
        )}
        <Button size="sm" onClick={onExport}>
          <DownloadIcon size={16} />
          {text.editor.export}
        </Button>
        <Button size="sm" onClick={duplicate}>
          <CopyIcon size={16} />
          {text.editor.duplicate}
        </Button>
      </div>
      {duplicateError && <FormError error={duplicateError} />}
    </div>
  );
}
