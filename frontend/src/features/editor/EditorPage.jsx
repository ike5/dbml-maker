import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { getDiagram } from "../../lib/api/diagrams.js";
import { text } from "../../text/en.js";
import { Banner, Button, EmptyState, Spinner } from "../../ui/index.js";
import { errorMessage } from "../../text/errors.js";
import { ExportDialog } from "../import-export/index.js";
import { ShareDialog } from "../shares/index.js";
import { VersionPanel } from "../versions/index.js";
import { ConflictBanner } from "./ConflictBanner.jsx";
import { EditorToolbar } from "./EditorToolbar.jsx";
import { useEditorRuntime } from "./runtime.js";
import { fromDiagram } from "./session.js";
import {
  createEditorStore,
  EditorStoreContext,
  useEditorStore,
  useEditorStoreApi,
} from "./store.js";
import { Workspace } from "./Workspace.jsx";
import "./editor.css";

/** The page of one diagram at /d/:diagramId (DESIGN.md §12.4). */
export function EditorPage() {
  const { diagramId } = useParams();
  const query = useQuery({
    queryKey: ["diagram", diagramId],
    queryFn: () => getDiagram(diagramId),
    // After the load, the store is the source of truth. A new fetch must not replace it.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    // A new visit must read the diagram again, not the old copy in the cache.
    gcTime: 0,
  });

  if (query.isPending) {
    return (
      <div className="editor-center">
        <Spinner />
      </div>
    );
  }
  if (query.error?.status === 404) {
    return (
      <div className="editor-center">
        <EmptyState
          title={text.editor.notFoundTitle}
          action={<Link to="/">{text.editor.notFoundAction}</Link>}
        >
          {text.editor.notFoundBody}
        </EmptyState>
      </div>
    );
  }
  if (query.error) {
    return (
      <div className="editor-center">
        <Banner
          kind="error"
          actions={
            <Button size="sm" onClick={() => query.refetch()}>
              {text.common.retry}
            </Button>
          }
        >
          {text.editor.loadFailed} {errorMessage(query.error)}
        </Banner>
      </div>
    );
  }
  // The key makes a new store for each diagram, for example after "Duplicate".
  return <EditorSession key={diagramId} initial={query.data} />;
}

function EditorSession({ initial }) {
  const [store] = useState(() => createEditorStore(fromDiagram(initial.diagram, initial.etag)));
  return (
    <EditorStoreContext.Provider value={store}>
      <EditorView />
    </EditorStoreContext.Provider>
  );
}

function EditorView() {
  const canvasRef = useRef(null);
  const diagramId = useEditorStore((s) => s.diagramId);
  const name = useEditorStore((s) => s.name);
  const source = useEditorStore((s) => s.source);
  const role = useEditorStore((s) => s.role);
  const saveState = useEditorStore((s) => s.saveState);
  const storeApi = useEditorStoreApi();
  const autosave = useEditorRuntime(storeApi, { autosave: role !== "viewer" });
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="editor-page">
      <EditorToolbar
        canvasRef={canvasRef}
        autosave={autosave}
        versionsOpen={versionsOpen}
        onToggleVersions={() => setVersionsOpen((open) => !open)}
        onShare={() => setShareOpen(true)}
        onExport={() => setExportOpen(true)}
      />
      {saveState === "conflict" && <ConflictBanner autosave={autosave} />}
      <div className="editor-body">
        <div className="editor-main">
          <Workspace canvasRef={canvasRef} viewportKey={`dbml-maker:viewport:${diagramId}`} />
        </div>
        {versionsOpen && (
          <div className="editor-versions">
            <VersionPanel
              diagramId={diagramId}
              canEdit={role !== "viewer"}
              getChangeNumber={() => storeApi.getState().etag}
              onRestored={({ diagram, etag }) => {
                // A save of the old content must not run after the restore.
                autosave?.cancel();
                storeApi.getState().load(fromDiagram(diagram, etag));
              }}
              onClose={() => setVersionsOpen(false)}
            />
          </div>
        )}
      </div>
      {shareOpen && (
        <ShareDialog diagramId={diagramId} diagramName={name} onClose={() => setShareOpen(false)} />
      )}
      {exportOpen && (
        <ExportDialog
          name={name}
          source={source}
          exportImage={(format) => canvasRef.current.exportImage(format)}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
