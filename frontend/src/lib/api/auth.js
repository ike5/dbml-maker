// The allauth headless flows of DESIGN.md §5.3. allauth uses 401 for normal
// states (not logged in, address not verified, no login after a reset), so
// these functions turn those states into plain results.
import { ApiError, apiRequest } from "./client.js";

const BASE = "/_allauth/browser/v1";

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} email
 * @property {string} display
 */

/**
 * @typedef {{ email: string, primary: boolean, verified: boolean }} EmailAddress
 */

/**
 * Change the user object of allauth into the user object of the SPA.
 * @param {{ id: string | number, email?: string, display?: string }} raw
 * @returns {User}
 */
export function normalizeUser(raw) {
  const email = raw.email ?? "";
  return { id: String(raw.id), email, display: raw.display || email };
}

function userOf(response) {
  return normalizeUser(response.data.data.user);
}

// A 401 from allauth lists the flows. A flow with is_pending is in progress.
function hasPendingFlow(body, id) {
  const flows = body?.data?.flows;
  return Array.isArray(flows) && flows.some((flow) => flow.id === id && flow.is_pending);
}

function unexpected(response) {
  return new ApiError({
    status: response.status,
    code: "request_failed",
    message: "",
    body: response.data,
  });
}

/**
 * Read the current session.
 * @returns {Promise<User | null>} The user, or null if nobody is logged in.
 */
export async function getSession() {
  const response = await apiRequest("GET", `${BASE}/auth/session`, {
    allowStatuses: [401, 410],
  });
  return response.status === 200 ? userOf(response) : null;
}

/**
 * Log in (AUTH-002).
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ status: "ok", user: User } | { status: "verify_email" }>}
 */
export async function login({ email, password }) {
  const response = await apiRequest("POST", `${BASE}/auth/login`, {
    body: { email, password },
    allowStatuses: [401],
  });
  if (response.status === 200) return { status: "ok", user: userOf(response) };
  if (hasPendingFlow(response.data, "verify_email")) return { status: "verify_email" };
  throw unexpected(response);
}

/**
 * Sign up (AUTH-001). The answer is the same for a known and an unknown address (AUTH-003).
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ status: "ok", user: User } | { status: "verify_email" }>}
 */
export async function signup({ email, password }) {
  const response = await apiRequest("POST", `${BASE}/auth/signup`, {
    body: { email, password },
    allowStatuses: [401],
  });
  if (response.status === 200) return { status: "ok", user: userOf(response) };
  if (hasPendingFlow(response.data, "verify_email")) return { status: "verify_email" };
  throw unexpected(response);
}

/** End the session. allauth answers 401, because the user is then logged out. */
export async function logout() {
  await apiRequest("DELETE", `${BASE}/auth/session`, { allowStatuses: [401] });
}

/**
 * Read the information of an email verification key.
 * @param {string} key
 * @returns {Promise<{ email: string }>}
 */
export async function getEmailVerification(key) {
  const response = await apiRequest("GET", `${BASE}/auth/email/verify`, {
    headers: { "X-Email-Verification-Key": key },
  });
  return { email: response.data.data.email };
}

/**
 * Verify the email address with the key from the email.
 * @param {string} key
 * @returns {Promise<{ status: "ok", user: User } | { status: "login_required" }>}
 */
export async function verifyEmail(key) {
  const response = await apiRequest("POST", `${BASE}/auth/email/verify`, {
    body: { key },
    allowStatuses: [401],
  });
  return response.status === 200
    ? { status: "ok", user: userOf(response) }
    : { status: "login_required" };
}

/**
 * Ask for a password reset email (AUTH-003).
 * @param {string} email
 */
export async function requestPasswordReset(email) {
  await apiRequest("POST", `${BASE}/auth/password/request`, { body: { email } });
}

/**
 * Check a password reset key. A key that is not correct gives an ApiError.
 * The function returns the email address of the user, and a query function
 * must not return undefined.
 * @param {string} key
 * @returns {Promise<{ email: string }>}
 */
export async function getPasswordReset(key) {
  const response = await apiRequest("GET", `${BASE}/auth/password/reset`, {
    headers: { "X-Password-Reset-Key": key },
  });
  return { email: response.data.data.user.email };
}

/**
 * Set the new password with the key from the email (AUTH-004).
 * @param {{ key: string, password: string }} values
 * @returns {Promise<{ status: "ok", user: User } | { status: "login_required" }>}
 */
export async function resetPassword({ key, password }) {
  const response = await apiRequest("POST", `${BASE}/auth/password/reset`, {
    body: { key, password },
    allowStatuses: [401],
  });
  return response.status === 200
    ? { status: "ok", user: userOf(response) }
    : { status: "login_required" };
}

/**
 * Change the password of the logged-in user.
 * @param {{ currentPassword: string, newPassword: string }} values
 */
export async function changePassword({ currentPassword, newPassword }) {
  await apiRequest("POST", `${BASE}/account/password/change`, {
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

/**
 * @returns {Promise<EmailAddress[]>}
 */
export async function listEmailAddresses() {
  const response = await apiRequest("GET", `${BASE}/account/email`);
  return response.data.data;
}

/**
 * Ask to change the email address. allauth sends a verification email to the
 * new address, and it changes the address only after the verification.
 * @param {string} email
 * @returns {Promise<EmailAddress[]>}
 */
export async function changeEmail(email) {
  const response = await apiRequest("POST", `${BASE}/account/email`, { body: { email } });
  return response.data.data;
}

/**
 * Authenticate again with the password, before a sensitive action (§5.4).
 * @param {string} password
 */
export async function reauthenticate(password) {
  await apiRequest("POST", `${BASE}/auth/reauthenticate`, { body: { password } });
}
