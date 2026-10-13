import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getPasswordReset, resetPassword } from "../../lib/api/auth.js";
import { text } from "../../text/en.js";
import { Banner, Button, FormError, Spinner, TextField } from "../../ui/index.js";
import { fieldError, formLevelError } from "./formErrors.js";
import { SESSION_KEY } from "./session.jsx";

export function ResetPasswordPage() {
  const t = text.auth.reset;
  const { key } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");

  const info = useQuery({
    queryKey: ["password-reset", key],
    queryFn: () => getPasswordReset(key),
    retry: false,
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: (result) => {
      if (result.status === "ok") {
        queryClient.setQueryData(SESSION_KEY, result.user);
        navigate("/", { replace: true });
      } else {
        navigate("/login", { replace: true, state: { notice: "reset" } });
      }
    },
  });

  if (info.isPending) return <Spinner />;
  if (info.isError) {
    return (
      <div>
        <h1>{t.title}</h1>
        <Banner kind="error">{t.invalid}</Banner>
        <p>
          <Link to="/reset-password">{t.toRequest}</Link>
        </p>
      </div>
    );
  }

  const error = mutation.error;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate({ key, password });
      }}
    >
      <h1>{t.title}</h1>
      <TextField
        label={text.auth.newPassword}
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint={text.auth.passwordHint}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldError(error, "password")}
      />
      <FormError error={formLevelError(error, ["password"])} />
      <Button type="submit" variant="primary" disabled={mutation.isPending}>
        {t.submit}
      </Button>
    </form>
  );
}
