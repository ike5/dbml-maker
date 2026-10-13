import { useQuery } from "@tanstack/react-query";
import { getVersion } from "../../lib/api/diagrams.js";
import { Banner, Button, Dialog, Spinner } from "../../ui/index.js";
import { text } from "../../text/en.js";
import { errorMessage } from "../../text/errors.js";

/**
 * Shows the source of a version. React escapes the text, so the source
 * never becomes HTML (EDT-005, DESIGN.md §4.7).
 */
export function ShowDialog({ diagramId, versionId, onClose }) {
  const query = useQuery({
    queryKey: ["versions", diagramId, versionId],
    queryFn: () => getVersion(diagramId, versionId),
  });
  return (
    <Dialog
      title={text.versions.showTitle}
      onClose={onClose}
      footer={<Button onClick={onClose}>{text.common.close}</Button>}
    >
      {query.isPending && <Spinner />}
      {query.isError && <Banner kind="error">{errorMessage(query.error)}</Banner>}
      {query.isSuccess && <pre className="version-source">{query.data.source}</pre>}
    </Dialog>
  );
}
