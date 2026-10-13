import { useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disablePublicLink,
  enablePublicLink,
  getPublicLink,
  rotatePublicLink,
} from "../../lib/api/diagrams.js";
import { Banner, Button, CopyIcon, FormError, Spinner, TextField } from "../../ui/index.js";
import { text } from "../../text/en.js";

/**
 * The controls of the public link (SHR-002, SHR-003, SHR-004).
 * @param {{ diagramId: string }} props
 */
export function PublicLinkSection({ diagramId }) {
  const headingId = useId();
  const queryClient = useQueryClient();
  const key = ["public-link", diagramId];
  const link = useQuery({ queryKey: key, queryFn: () => getPublicLink(diagramId) });
  const fieldRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const [copyState, setCopyState] = useState(null);
  const [error, setError] = useState(null);

  const store = (data) => {
    setConfirming(false);
    setCopyState(null);
    queryClient.setQueryData(key, data);
  };
  const enable = useMutation({
    mutationFn: () => enablePublicLink(diagramId),
    onSuccess: store,
    onError: setError,
  });
  const rotate = useMutation({
    mutationFn: () => rotatePublicLink(diagramId),
    onSuccess: store,
    onError: setError,
  });
  const disable = useMutation({
    mutationFn: () => disablePublicLink(diagramId),
    onSuccess: () => store({ enabled: false, token: null, url: null, created_at: null }),
    onError: setError,
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.data.url);
      setCopyState("copied");
    } catch {
      // The user can still copy by hand, so select the text.
      fieldRef.current?.select();
      setCopyState("failed");
    }
  }

  function run(mutation) {
    setError(null);
    mutation.mutate();
  }

  const busy = enable.isPending || rotate.isPending || disable.isPending;

  return (
    <section className="share-section" aria-labelledby={headingId}>
      <h3 id={headingId}>{text.shares.linkHeading}</h3>
      {link.isPending && <Spinner />}
      {link.isError && <FormError error={link.error} />}
      {link.data && !link.data.enabled && (
        <>
          <p className="share-muted">{text.shares.linkOffText}</p>
          <div className="share-actions">
            <Button variant="primary" disabled={busy} onClick={() => run(enable)}>
              {text.shares.linkTurnOn}
            </Button>
          </div>
        </>
      )}
      {link.data?.enabled && (
        <>
          <TextField
            label={text.shares.linkLabel}
            value={link.data.url}
            readOnly
            onFocus={(event) => event.target.select()}
            ref={fieldRef}
          />
          <div className="share-actions">
            <Button onClick={copy}>
              <CopyIcon />
              {text.shares.linkCopy}
            </Button>
            <Button disabled={busy} onClick={() => setConfirming(true)}>
              {text.shares.linkRotate}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => run(disable)}>
              {text.shares.linkTurnOff}
            </Button>
          </div>
          <div aria-live="polite">
            {copyState === "copied" && <p className="share-muted">{text.shares.linkCopied}</p>}
            {copyState === "failed" && <p className="share-muted">{text.shares.linkCopyFailed}</p>}
          </div>
          {confirming && (
            <Banner
              kind="warning"
              actions={
                <>
                  <Button size="sm" onClick={() => setConfirming(false)}>
                    {text.common.cancel}
                  </Button>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => run(rotate)}>
                    {text.shares.linkRotateConfirm}
                  </Button>
                </>
              }
            >
              {text.shares.linkRotateWarning}
            </Banner>
          )}
        </>
      )}
      <FormError error={error} />
    </section>
  );
}
