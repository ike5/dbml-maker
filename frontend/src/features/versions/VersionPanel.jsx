import { useId, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createVersion, listVersions } from "../../lib/api/diagrams.js";
import { Banner, Button, CloseIcon, EmptyState, IconButton, Spinner } from "../../ui/index.js";
import { text } from "../../text/en.js";
import { errorMessage } from "../../text/errors.js";
import { format } from "../../text/format.js";
import { MakeVersionForm } from "./MakeVersionForm.jsx";
import { RestoreDialog } from "./RestoreDialog.jsx";
import { ShowDialog } from "./ShowDialog.jsx";
import "./versions.css";

const KIND_TEXT = {
  auto: text.versions.kindAuto,
  named: text.versions.kindNamed,
  restore: text.versions.kindRestore,
};

const dateTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function personName(user) {
  if (!user) return text.versions.unknownPerson;
  return user.display_name || user.email;
}

function VersionItem({ version, canEdit, onShow, onRestore }) {
  const kind = KIND_TEXT[version.kind] ?? version.kind;
  const name = version.label || kind;
  return (
    <li className="version-item">
      <span className="version-kind">{kind}</span>
      {version.label && <span className="version-label">{version.label}</span>}
      <span className="version-meta">
        {dateTime.format(new Date(version.created_at))}{" "}
        {format(text.versions.byPerson, { person: personName(version.created_by) })}
      </span>
      <span className="version-meta">
        {format(text.versions.changeNumber, { number: version.change_number })}
      </span>
      <div className="version-actions">
        <Button
          size="sm"
          aria-label={format(text.versions.showFor, { name })}
          onClick={() => onShow(version)}
        >
          {text.versions.show}
        </Button>
        {canEdit && (
          <Button
            size="sm"
            aria-label={format(text.versions.restoreFor, { name })}
            onClick={() => onRestore(version)}
          >
            {text.versions.restore}
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * The side panel with the versions of a diagram (VER-001, VER-003, EDT-005).
 * @param {object} props
 * @param {string} props.diagramId
 * @param {boolean} props.canEdit False for a viewer: no form and no restore.
 * @param {() => number} props.getChangeNumber Gives the change number of the editor at call time.
 * @param {(result: { diagram: object, etag: number }) => void} props.onRestored
 * @param {() => void} props.onClose
 */
export function VersionPanel({ diagramId, canEdit, getChangeNumber, onRestored, onClose }) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(null);
  const [made, setMade] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ["versions", diagramId],
    queryFn: ({ pageParam }) => listVersions(diagramId, { cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (last) => last.next,
  });
  const versions = query.data?.pages.flatMap((page) => page.results) ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["versions", diagramId] });
  const make = useMutation({
    mutationFn: (label) => createVersion(diagramId, { label }),
    onSuccess: () => {
      setMade(true);
      refresh();
    },
  });

  return (
    <aside className="version-panel" aria-labelledby={titleId}>
      <div className="version-panel-header">
        <h2 id={titleId}>{text.versions.title}</h2>
        <IconButton label={text.common.close} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>
      <div className="version-panel-body">
        {canEdit && (
          <MakeVersionForm
            onSubmit={(label) => make.mutateAsync(label)}
            onEdit={() => setMade(false)}
          />
        )}
        {made && <Banner kind="success">{text.versions.made}</Banner>}

        {query.isPending && <Spinner />}
        {query.isError && (
          <Banner
            kind="error"
            actions={<Button onClick={() => query.refetch()}>{text.common.retry}</Button>}
          >
            {errorMessage(query.error)}
          </Banner>
        )}
        {query.isSuccess && versions.length === 0 && <EmptyState title={text.versions.empty} />}
        {versions.length > 0 && (
          <ul className="version-list">
            {versions.map((version) => (
              <VersionItem
                key={version.id}
                version={version}
                canEdit={canEdit}
                onShow={(item) => setDialog({ action: "show", version: item })}
                onRestore={(item) => setDialog({ action: "restore", version: item })}
              />
            ))}
          </ul>
        )}
        {query.hasNextPage && (
          <div className="version-more">
            <Button onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
              {text.versions.loadMore}
            </Button>
          </div>
        )}
      </div>

      {dialog?.action === "show" && (
        <ShowDialog
          diagramId={diagramId}
          versionId={dialog.version.id}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.action === "restore" && (
        <RestoreDialog
          diagramId={diagramId}
          versionId={dialog.version.id}
          getChangeNumber={getChangeNumber}
          onRestored={(result) => {
            refresh();
            setDialog(null);
            onRestored(result);
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </aside>
  );
}
