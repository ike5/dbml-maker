import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { duplicatePublicDiagram, getPublicDiagram } from "../../lib/api/public.js";
import { text } from "../../text/en.js";
import { errorMessage } from "../../text/errors.js";
import { Banner, Button, DownloadIcon, EmptyState, FormError, Spinner } from "../../ui/index.js";
import { useSession } from "../auth/index.js";
import { ExportDialog } from "../import-export/index.js";
import { useEditorRuntime } from "./runtime.js";
import { fromPublicDiagram } from "./session.js";
import {
  createEditorStore,
  EditorStoreContext,
  useEditorStore,
  useEditorStoreApi,
} from "./store.js";
import { Workspace } from "./Workspace.jsx";
import "./editor.css";

function PublicShell({ children }) {
  return (
    <div className="editor-page public-page">
      <header className="public-header">
        <Link to="/" className="app-brand">
          {text.app.name}
        </Link>
        {children}
      </header>
    </div>
  );
}

/** The read only page of a public link at /s/:token (DESIGN.md §7.6, §12.6). */
export function PublicViewPage() {
  const { token } = useParams();
  const query = useQuery({
    queryKey: ["public", token],
    queryFn: () => getPublicDiagram(token),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    gcTime: 0,
  });

  if (query.isPending) {
    return (
      <PublicShell>
        <Spinner />
      </PublicShell>
    );
  }
  if (query.error?.status === 404) {
    return (
      <div className="editor-center">
        <EmptyState
          title={text.editor.publicNotFoundTitle}
          action={<Link to="/">{text.editor.publicNotFoundAction}</Link>}
        >
          {text.editor.publicNotFoundBody}
        </EmptyState>
      </div>
    );
  }
  if (query.error) {
    return (
      <PublicShell>
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
      </PublicShell>
    );
  }
  return <PublicSession key={token} token={token} diagram={query.data} />;
}

function PublicSession({ token, diagram }) {
  const [store] = useState(() => createEditorStore(fromPublicDiagram(token, diagram)));
  return (
    <EditorStoreContext.Provider value={store}>
      <PublicView token={token} />
    </EditorStoreContext.Provider>
  );
}

function PublicView({ token }) {
  const canvasRef = useRef(null);
  const name = useEditorStore((s) => s.name);
  const source = useEditorStore((s) => s.source);
  const store = useEditorStoreApi();
  useEditorRuntime(store, { autosave: false });
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [exportOpen, setExportOpen] = useState(false);
  const [copyError, setCopyError] = useState(null);

  async function makeCopy() {
    setCopyError(null);
    try {
      const { diagram } = await duplicatePublicDiagram(token);
      await queryClient.invalidateQueries({ queryKey: ["diagrams"] });
      navigate(`/d/${diagram.id}`);
    } catch (error) {
      setCopyError(error);
    }
  }

  return (
    <div className="editor-page public-page">
      <header className="public-header">
        <Link to="/" className="app-brand">
          {text.app.name}
        </Link>
        <h1 className="editor-name">{name}</h1>
        <p>{text.editor.publicNote}</p>
        <div className="editor-toolbar-actions">
          <Button size="sm" onClick={() => setExportOpen(true)}>
            <DownloadIcon size={16} />
            {text.editor.export}
          </Button>
          {user ? (
            <Button size="sm" variant="primary" onClick={makeCopy}>
              {text.editor.makeCopy}
            </Button>
          ) : (
            <Link to={`/login?next=/s/${encodeURIComponent(token)}`}>
              {text.editor.loginToCopy}
            </Link>
          )}
        </div>
        {copyError && <FormError error={copyError} />}
      </header>
      <div className="editor-body">
        <div className="editor-main">
          <Workspace canvasRef={canvasRef} viewportKey={`dbml-maker:viewport:public:${token}`} />
        </div>
      </div>
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
