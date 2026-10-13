import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router";
import { login } from "../../lib/api/auth.js";
import { text } from "../../text/en.js";
import { Banner, Button, FormError, Spinner, TextField } from "../../ui/index.js";
import { fieldError, formLevelError } from "./formErrors.js";
import { SESSION_KEY, safeNext, useSession } from "./session.jsx";

export function LoginPage() {
  const t = text.auth;
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const location = useLocation();
  const { user, isLoading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: login,
    // The redirect below runs as soon as the session has a user.
    onSuccess: (result) => {
      if (result.status === "ok") queryClient.setQueryData(SESSION_KEY, result.user);
    },
  });

  if (isLoading) return <Spinner />;
  if (user) return <Navigate to={safeNext(params.get("next"))} replace />;

  const notice = location.state?.notice;
  const error = mutation.error;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate({ email, password });
      }}
    >
      <h1>{t.login.title}</h1>
      {notice === "reset" && <Banner kind="success">{t.login.resetDone}</Banner>}
      {notice === "deleted" && <Banner kind="success">{t.login.accountDeleted}</Banner>}
      {mutation.data?.status === "verify_email" && (
        <Banner kind="warning">{t.login.unverified}</Banner>
      )}
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
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldError(error, "password")}
      />
      <FormError error={formLevelError(error, ["email", "password"])} />
      <Button type="submit" variant="primary" disabled={mutation.isPending}>
        {t.login.submit}
      </Button>
      <p>
        <Link to="/signup">{t.login.toSignup}</Link>
      </p>
      <p>
        <Link to="/reset-password">{t.login.toReset}</Link>
      </p>
    </form>
  );
}
