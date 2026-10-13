import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { requestPasswordReset } from "../../lib/api/auth.js";
import { text } from "../../text/en.js";
import { Banner, Button, FormError, TextField } from "../../ui/index.js";
import { fieldError, formLevelError } from "./formErrors.js";

export function ResetPasswordRequestPage() {
  const t = text.auth.resetRequest;
  const [email, setEmail] = useState("");
  const mutation = useMutation({ mutationFn: requestPasswordReset });

  const toLogin = (
    <p>
      <Link to="/login">{t.toLogin}</Link>
    </p>
  );

  // AUTH-003: the message is the same for a known and an unknown address.
  if (mutation.isSuccess) {
    return (
      <div>
        <h1>{t.title}</h1>
        <Banner kind="success">{t.sent}</Banner>
        {toLogin}
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(email);
      }}
    >
      <h1>{t.title}</h1>
      <TextField
        label={text.auth.email}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldError(mutation.error, "email")}
      />
      <FormError error={formLevelError(mutation.error, ["email"])} />
      <Button type="submit" variant="primary" disabled={mutation.isPending}>
        {t.submit}
      </Button>
      {toLogin}
    </form>
  );
}
