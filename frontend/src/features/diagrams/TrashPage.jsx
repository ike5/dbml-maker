import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteDiagramPermanently, listDiagrams, restoreDiagram } from "../../lib/api/diagrams.js";
import { Banner, Button, EmptyState, Spinner } from "../../ui/index.js";
import { text } from "../../text/en.js";
import { errorMessage } from "../../text/errors.js";
import { format } from "../../text/format.js";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { dateText, relativeTime } from "./time.js";
import "./diagrams.css";

// The server is the authority for this period (DESIGN.md §7.1). The page only shows the date.
const TRASH_RETENTION_DAYS = 30;

function deleteDate(trashedAt) {
  const date = new Date(trashedAt);
  date.setDate(date.getDate() + TRASH_RETENTION_DAYS);
  return dateText(date.toISOString());
}

export function TrashPage() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(null);

  const query = useInfiniteQuery({
    queryKey: ["diagrams", "trash"],
    queryFn: ({ pageParam }) => listDiagrams({ scope: "trash", cursor: pageParam }),
    initialPageParam: null,
    getNextPageParam: (last) => last.next,
  });
  const diagrams = query.data?.pages.flatMap((page) => page.results) ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["diagrams"] });
  const restore = useMutation({ mutationFn: restoreDiagram, onSuccess: refresh });
  const remove = useMutation({
    mutationFn: deleteDiagramPermanently,
    onSuccess: async () => {
      await refresh();
      setDeleting(null);
    },
  });

  return (
    <div className="page">
      <div className="diagrams-header">
        <h1>{text.diagrams.trashHeading}</h1>
      </div>
      {restore.isError && <Banner kind="error">{errorMessage(restore.error)}</Banner>}
      {query.isPending && <Spinner />}
      {query.isError && (
        <Banner
          kind="error"
          actions={<Button onClick={() => query.refetch()}>{text.common.retry}</Button>}
        >
          {errorMessage(query.error)}
        </Banner>
      )}
      {query.isSuccess && diagrams.length === 0 && <EmptyState title={text.diagrams.trashEmpty} />}
      {diagrams.length > 0 && (
        <ul className="diagram-list">
          {diagrams.map((diagram) => (
            <li key={diagram.id} className="diagram-row">
              <div className="diagram-main">
                <span className="diagram-name">{diagram.name}</span>
                <span className="diagram-meta">
                  {format(text.diagrams.trashedAt, { time: relativeTime(diagram.trashed_at) })}.{" "}
                  {format(text.diagrams.deletesOn, { date: deleteDate(diagram.trashed_at) })}
                </span>
              </div>
              <Button onClick={() => restore.mutate(diagram.id)} disabled={restore.isPending}>
                {text.diagrams.restore}
              </Button>
              <Button variant="danger" onClick={() => setDeleting(diagram)}>
                {text.diagrams.deletePermanently}
              </Button>
            </li>
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
      {deleting && (
        <ConfirmDialog
          title={text.diagrams.deleteTitle}
          body={format(text.diagrams.deleteBody, { name: deleting.name })}
          confirmLabel={text.diagrams.deletePermanently}
          onConfirm={() => remove.mutateAsync(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
