// Stubs. The auth feature replaces this file with the real pages and hooks.
import { text } from "../../text/en.js";

const placeholder = (title) =>
  function Placeholder() {
    return <h1>{title}</h1>;
  };

export const LoginPage = placeholder(text.auth.stubLogin);
export const SignupPage = placeholder(text.auth.stubSignup);
export const VerifyEmailPage = placeholder(text.auth.stubVerifyEmail);
export const ResetPasswordRequestPage = placeholder(text.auth.stubResetRequest);
export const ResetPasswordPage = placeholder(text.auth.stubReset);
export const SettingsPage = placeholder(text.auth.stubSettings);

export function RequireAuth({ children }) {
  return children;
}

export function useSession() {
  return { user: null, isLoading: false };
}

export function useLogout() {
  return () => {};
}
