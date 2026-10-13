import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  createDiagram,
  duplicateDiagram,
  listDiagrams,
  trashDiagram,
  updateDiagram,
} from "../../lib/api/diagrams.js";
import { ImportDialog } from "../import-export/index.js";
import {
  Banner,
  Button,
  EmptyState,
  Menu,
  PlusIcon,
  Spinner,
  Tabs,
  UploadIcon,
} from "../../ui/index.js";
import { text } from "../../text/en.js";
import { errorMessage } from "../../text/errors.js";
import { format } from "../../text/format.js";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { NameDialog } from "./NameDialog.jsx";
import { STARTER_SOURCE } from "./starter.js";
import { personName, relativeTime } from "./time.js";
import "./diagrams.css";

const TABS = [
  { id: "mine", label: text.diagrams.tabMine },
  { id: "shared", label: text.diagrams.tabShared },
];

const ROLE_LABELS = {
  owner: text.diagrams.roleOwner,
  editor: text.diagrams.roleEditor,
  viewer: text.diagrams.roleViewer,
};

function changedText(diagram) {
  const time = relativeTime(diagram.updated_at);
  if (!diagram.updated_by) return format(text.diagrams.changed, { time });
  return format(text.diagrams.changedBy, { time, person: personName(diagram.updated_by) });
}

function DiagramRow({ diagram, scope, onAction }) {
  // The actions for each role (DESIGN.md §4.3).
  const canRename = diagram.role === "owner" || diagram.role === "editor";
  const canTrash = diagram.role === "owner";
  const items = [
    { label: text.diagrams.open, onSelect: () => onAction("open", diagram) },
    canRename && { label: text.diagrams.rename, onSelect: () => onAction("rename", diagram) },
    { label: text.diagrams.duplicate, onSelect: () => onAction("duplicate", diagram) },
    canTrash && {
      label: text.diagrams.moveToTrash,
      danger: true,
      onSelect: () => onAction("trash", diagram),
    },
  ].filter(Boolean);
  return (
    <li className="diagram-row">
      <div className="diagram-main">
        <Link className="diagram-name" to={`/d/${diagram.id}`}>
          {diagram.name}
        </Link>
        <span className="diagram-meta">
          {scope === "shared" && `${ROLE_LABELS[diagram.role]}. `}
          {changedText(diagram)}
        </span>
      </div>
      <Menu label={format(text.diagrams.actionsFor, { name: diagram.name })} items={items} />
    </li>
  );
}

export function DiagramListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = searchParams.get("tab") === "shared" ? "shared" : "mine";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [copy, setCopy] = useState(null);

  const query = useInfiniteQuery({
    queryKey: ["diagrams", scope],
    queryFn: ({ pageParam }) => listDiagrams({ scope, cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (last) => last.next,
  });
  const diagrams = query.data?.pages.flatMap((page) => page.results) ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["diagrams"] });
  const closeDialog = () => setDialog(null);

  const create = useMutation({
    mutationFn: (name) => createDiagram({ name, source: STARTER_SOURCE }),
    onSuccess: ({ diagram }) => navigate(`/d/${diagram.id}`),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }) => {
      // Use the newest change number that the list has, because a reload can change it.
      const current = diagrams.find((item) => item.id === id);
      return updateDiagram(id, { name }, { etag: current.change_number });
    },
    onSuccess: async () => {
      await refresh();
      closeDialog();
    },
    onError: (error) => {
      if (error.code === "diagram_conflict") refresh();
    },
  });
  const duplicate = useMutation({
    mutationFn: (id) => duplicateDiagram(id),
    onSuccess: ({ diagram }) => {
      setCopy(diagram);
      refresh();
    },
  });
  const trash = useMutation({
    mutationFn: (id) => trashDiagram(id),
    onSuccess: async () => {
      await refresh();
      closeDialog();
    },
  });

  function onAction(action, diagram) {
    if (action === "open") navigate(`/d/${diagram.id}`);
    else if (action === "duplicate") duplicate.mutate(diagram.id);
    else setDialog({ action, diagram });
  }

  function selectTab(id) {
    setCopy(null);
    setSearchParams(id === "shared" ? { tab: "shared" } : {});
  }

  return (
    <div className="page">
      <div className="diagrams-header">
        <h1>{text.diagrams.title}</h1>
        <div className="diagrams-actions">
          <Button onClick={() => setDialog({ action: "import" })}>
            <UploadIcon />
            {text.diagrams.importDiagram}
          </Button>
          <Button variant="primary" onClick={() => setDialog({ action: "new" })}>
            <PlusIcon />
            {text.diagrams.newDiagram}
          </Button>
        </div>
      </div>
      <Tabs label={text.diagrams.tabsLabel} tabs={TABS} value={scope} onChange={selectTab} />

      {copy && (
        <Banner kind="success" actions={<Link to={`/d/${copy.id}`}>{text.diagrams.openCopy}</Link>}>
          {text.diagrams.duplicated}
        </Banner>
      )}
      {duplicate.isError && <Banner kind="error">{errorMessage(duplicate.error)}</Banner>}

      {query.isPending && <Spinner />}
      {query.isError && (
        <Banner
          kind="error"
          actions={<Button onClick={() => query.refetch()}>{text.common.retry}</Button>}
        >
          {errorMessage(query.error)}
        </Banner>
      )}
      {query.isSuccess && diagrams.length === 0 && (
        <EmptyState
          title={scope === "mine" ? text.diagrams.emptyMine : text.diagrams.emptyShared}
        />
      )}
      {diagrams.length > 0 && (
        <ul className="diagram-list">
          {diagrams.map((diagram) => (
            <DiagramRow key={diagram.id} diagram={diagram} scope={scope} onAction={onAction} />
          ))}
        </ul>
      )}
      {query.hasNextPage && (
        <div className="diagrams-more">
          <Button onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {text.diagrams.loadMore}
          </Button>
        </div>
      )}

      {dialog?.action === "new" && (
        <NameDialog
          title={text.diagrams.newDiagram}
          initialName={text.diagrams.defaultName}
          submitLabel={text.diagrams.make}
          onSubmit={create.mutateAsync}
          onClose={closeDialog}
        />
      )}
      {dialog?.action === "import" && (
        <ImportDialog
          onImported={(diagram) => navigate(`/d/${diagram.id}`)}
          onClose={closeDialog}
        />
      )}
      {dialog?.action === "rename" && (
        <NameDialog
          title={text.diagrams.renameTitle}
          initialName={dialog.diagram.name}
          submitLabel={text.diagrams.rename}
          onSubmit={(name) => rename.mutateAsync({ id: dialog.diagram.id, name })}
          onClose={closeDialog}
        />
      )}
      {dialog?.action === "trash" && (
        <ConfirmDialog
          title={text.diagrams.trashTitle}
          body={format(text.diagrams.trashBody, { name: dialog.diagram.name })}
          confirmLabel={text.diagrams.moveToTrash}
          onConfirm={() => trash.mutateAsync(dialog.diagram.id)}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
