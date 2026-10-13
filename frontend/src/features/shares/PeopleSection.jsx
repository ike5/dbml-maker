import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createShare, deleteShare, listShares, updateShare } from "../../lib/api/diagrams.js";
import {
  Banner,
  Button,
  FormError,
  IconButton,
  Select,
  Spinner,
  TextField,
  TrashIcon,
} from "../../ui/index.js";
import { text } from "../../text/en.js";
import { format } from "../../text/format.js";

const ROLE_OPTIONS = [
  { value: "viewer", label: text.shares.roleViewer },
  { value: "editor", label: text.shares.roleEditor },
];

/**
 * The list of shares and the form to add a share (SHR-001, SHR-005).
 * @param {{ diagramId: string }} props
 */
export function PeopleSection({ diagramId }) {
  const headingId = useId();
  const queryClient = useQueryClient();
  const key = ["shares", diagramId];
  const shares = useQuery({ queryKey: key, queryFn: () => listShares(diagramId) });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [sentTo, setSentTo] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const [error, setError] = useState(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const add = useMutation({
    mutationFn: (input) => createShare(diagramId, input),
    onSuccess: (_share, input) => {
      setEmail("");
      // The message is the same for each address: the API does not tell if an account exists (SHR-005).
      setSentTo(input.email);
      return refresh();
    },
    onError: (caught) => {
      if (caught?.fields?.email) setFieldError(caught.fields.email.join(" "));
      else setError(caught);
    },
  });
  const change = useMutation({
    mutationFn: ({ id, role: newRole }) => updateShare(diagramId, id, { role: newRole }),
    onSuccess: refresh,
    onError: (caught) => {
      setError(caught);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id) => deleteShare(diagramId, id),
    onSuccess: refresh,
    onError: setError,
  });

  function submit(event) {
    event.preventDefault();
    setError(null);
    setFieldError(null);
    setSentTo(null);
    add.mutate({ email: email.trim(), role });
  }

  return (
    <section className="share-section" aria-labelledby={headingId}>
      <h3 id={headingId}>{text.shares.peopleHeading}</h3>
      <form className="share-form" onSubmit={submit} noValidate>
        <TextField
          label={text.shares.emailLabel}
          type="email"
          value={email}
          error={fieldError}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
        <Select
          label={text.shares.roleLabel}
          options={ROLE_OPTIONS}
          value={role}
          onChange={(event) => setRole(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={add.isPending}>
          {text.shares.shareAction}
        </Button>
      </form>
      <p className="share-muted">{text.shares.roleHint}</p>
      {sentTo && <Banner kind="success">{format(text.shares.sent, { email: sentTo })}</Banner>}
      <FormError error={error} />
      {shares.isPending && <Spinner />}
      {shares.isError && <FormError error={shares.error} />}
      {shares.data?.length === 0 && <p className="share-muted">{text.shares.noShares}</p>}
      {shares.data?.length > 0 && (
        <ul className="share-list">
          {shares.data.map((share) => (
            <li key={share.id} className="share-row">
              <span className="share-email">{share.email}</span>
              <select
                className="input"
                aria-label={format(text.shares.roleOf, { email: share.email })}
                value={share.role}
                onChange={(event) => {
                  setError(null);
                  change.mutate({ id: share.id, role: event.target.value });
                }}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <IconButton
                label={format(text.shares.remove, { email: share.email })}
                onClick={() => {
                  setError(null);
                  remove.mutate(share.id);
                }}
              >
                <TrashIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
