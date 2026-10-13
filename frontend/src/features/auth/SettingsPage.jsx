import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { deleteAccount } from "../../lib/api/accounts.js";
import { changeEmail, changePassword, reauthenticate } from "../../lib/api/auth.js";
import { format } from "../../text/format.js";
import { text } from "../../text/en.js";
import { Banner, Button, Dialog, FormError, TextField } from "../../ui/index.js";
import { fieldError, formLevelError } from "./formErrors.js";
import { useEndSession, useSession } from "./session.jsx";

function ChangeEmailForm() {
  const t = text.auth.settings;
  const [email, setEmail] = useState("");
  const mutation = useMutation({ mutationFn: changeEmail });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(email);
      }}
    >
      <TextField
        label={t.newEmail}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldError(mutation.error, "email")}
      />
      <FormError error={formLevelError(mutation.error, ["email"])} />
      {mutation.isSuccess && <Banner kind="success">{format(t.emailSent, { email })}</Banner>}
      <Button type="submit" disabled={mutation.isPending}>
        {t.emailSubmit}
      </Button>
    </form>
  );
}

function ChangePasswordForm() {
  const t = text.auth.settings;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
    },
  });
  const error = mutation.error;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate({ currentPassword, newPassword });
      }}
    >
      <TextField
        label={text.auth.currentPassword}
        type="password"
        autoComplete="current-password"
        required
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        error={fieldError(error, "current_password")}
      />
      <TextField
        label={text.auth.newPassword}
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint={text.auth.passwordHint}
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        error={fieldError(error, "new_password")}
      />
      <FormError error={formLevelError(error, ["current_password", "new_password"])} />
      {mutation.isSuccess && <Banner kind="success">{t.passwordChanged}</Banner>}
      <Button type="submit" disabled={mutation.isPending}>
        {t.passwordSubmit}
      </Button>
    </form>
  );
}

// AUTH-005: the user authenticates again, then the account goes.
async function reauthenticateAndDelete(password) {
  await reauthenticate(password);
  await deleteAccount();
}

function DeleteAccountDialog({ onClose }) {
  const t = text.auth.settings;
  const navigate = useNavigate();
  const endSession = useEndSession();
  const [password, setPassword] = useState("");
  const mutation = useMutation({
    mutationFn: reauthenticateAndDelete,
    onSuccess: () => {
      endSession();
      navigate("/login", { replace: true, state: { notice: "deleted" } });
    },
  });

  return (
    <Dialog
      title={t.deleteDialogTitle}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{text.common.cancel}</Button>
          <Button
            variant="danger"
            disabled={mutation.isPending || password === ""}
            onClick={() => mutation.mutate(password)}
          >
            {t.deleteConfirm}
          </Button>
        </>
      }
    >
      <p>{t.deleteDialogBody}</p>
      <TextField
        label={text.auth.password}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldError(mutation.error, "password")}
      />
      <FormError error={formLevelError(mutation.error, ["password"])} />
    </Dialog>
  );
}

export function SettingsPage() {
  const t = text.auth.settings;
  const { user } = useSession();
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="settings-page">
      <h1>{t.title}</h1>

      <section>
        <h2>{t.emailTitle}</h2>
        {user && <p>{format(t.currentEmail, { email: user.email })}</p>}
        <ChangeEmailForm />
      </section>

      <section>
        <h2>{t.passwordTitle}</h2>
        <ChangePasswordForm />
      </section>

      <section>
        <h2>{t.deleteTitle}</h2>
        <p>{t.deleteBody}</p>
        <Button variant="danger" onClick={() => setDeleting(true)}>
          {t.deleteOpen}
        </Button>
        {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
      </section>
    </div>
  );
}
