import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { getEmailVerification, verifyEmail } from "../../lib/api/auth.js";
import { text } from "../../text/en.js";
import { Banner, Spinner } from "../../ui/index.js";
import { SESSION_KEY } from "./session.jsx";

async function readAndVerify(key) {
  await getEmailVerification(key);
  return verifyEmail(key);
}

export function VerifyEmailPage() {
  const t = text.auth.verify;
  const { key } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // A query, not an effect: the key works one time, and React runs an effect
  // two times in development. A query shares one request between both runs.
  const { data, isError } = useQuery({
    queryKey: ["verify-email", key],
    queryFn: () => readAndVerify(key),
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data?.status === "ok") {
      queryClient.setQueryData(SESSION_KEY, data.user);
      navigate("/", { replace: true });
    }
  }, [data, queryClient, navigate]);

  const toLogin = (
    <p>
      <Link to="/login">{t.toLogin}</Link>
    </p>
  );

  if (isError) {
    return (
      <div>
        <h1>{t.title}</h1>
        <Banner kind="error">{t.invalid}</Banner>
        {toLogin}
      </div>
    );
  }
  if (data?.status === "login_required") {
    return (
      <div>
        <h1>{t.title}</h1>
        <Banner kind="success">{t.done}</Banner>
        {toLogin}
      </div>
    );
  }
  return (
    <div>
      <h1>{t.title}</h1>
      <Spinner label={t.working} />
    </div>
  );
}
