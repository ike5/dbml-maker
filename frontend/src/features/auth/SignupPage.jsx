import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { signup } from "../../lib/api/auth.js";
import { text } from "../../text/en.js";
import { Banner, Button, FormError, TextField } from "../../ui/index.js";
import { fieldError, formLevelError } from "./formErrors.js";
import { SESSION_KEY } from "./session.jsx";

export function SignupPage() {
  const t = text.auth;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: signup,
    onSuccess: (result) => {
      if (result.status === "ok") {
        queryClient.setQueryData(SESSION_KEY, result.user);
        navigate("/", { replace: true });
      }
    },
  });

  const error = mutation.error;
  // AUTH-003: the message is the same for a known and an unknown address.
  const sent = mutation.data?.status === "verify_email";
  // AUTH-006: allauth answers 403 when sign-up is closed.
  const closed = error?.status === 403;

  if (sent) {
    return (
      <div>
        <h1>{t.signup.title}</h1>
        <Banner kind="success">{t.signup.sent}</Banner>
        <p>
          <Link to="/login">{t.signup.toLogin}</Link>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate({ email, password });
      }}
    >
      <h1>{t.signup.title}</h1>
      {closed && <Banner kind="warning">{t.signup.closed}</Banner>}
      <TextField
        label={t.email}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldError(error, "email")}
      />
      <TextField
        label={t.password}
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint={t.passwordHint}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldError(error, "password")}
      />
      {!closed && <FormError error={formLevelError(error, ["email", "password"])} />}
      <Button type="submit" variant="primary" disabled={mutation.isPending}>
        {t.signup.submit}
      </Button>
      <p>
        <Link to="/login">{t.signup.toLogin}</Link>
      </p>
    </form>
  );
}
