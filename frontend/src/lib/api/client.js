// The only module that calls fetch (DESIGN.md §12.3, §12.5).

/**
 * An error from the API or from the network.
 */
export class ApiError extends Error {
  /**
   * @param {object} details
   * @param {number} details.status HTTP status. 0 for a network error.
   * @param {string} details.code Stable error code.
   * @param {string} details.message Text from the server, or a general text.
   * @param {Record<string, string[]> | null} [details.fields] Messages for each field.
   * @param {unknown} [details.body] The parsed body of the response.
   */
  constructor({ status, code, message, fields = null, body = null }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.body = body;
  }
}

const CSRF_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let unauthorizedHandler = null;
let releaseMismatchHandler = null;
let releaseMismatchReported = false;

/**
 * Register the function that runs when a request to /api/ gets 401.
 * allauth paths are excluded, because allauth uses 401 for normal states.
 * @param {() => void} handler
 * @returns {() => void} A function that removes the handler.
 */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

/**
 * Register the function that runs one time when X-App-Release is different
 * from the release of the SPA (DESIGN.md §11.5).
 * @param {() => void} handler
 * @returns {() => void} A function that removes the handler.
 */
export function onReleaseMismatch(handler) {
  releaseMismatchHandler = handler;
  return () => {
    if (releaseMismatchHandler === handler) releaseMismatchHandler = null;
  };
}

/** Make the one-time release report possible again. Tests use this function. */
export function resetReleaseCheck() {
  releaseMismatchReported = false;
}

/**
 * @returns {string | null} The value of the csrftoken cookie.
 */
export function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Ask the server to set the csrftoken cookie (DESIGN.md §4.2). */
export async function ensureCsrfCookie() {
  await apiRequest("GET", "/api/v1/csrf");
}

function checkRelease(response) {
  const release = response.headers.get("X-App-Release");
  if (release && release !== __APP_RELEASE__ && !releaseMismatchReported) {
    releaseMismatchReported = true;
    releaseMismatchHandler?.();
  }
}

async function readBody(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Reads the error envelope of the API (§11.3) or the envelope of allauth.
function toApiError(status, body) {
  if (body && typeof body === "object") {
    if (body.error && typeof body.error === "object") {
      const { code, message, fields } = body.error;
      return new ApiError({
        status,
        code: code ?? "server_error",
        message: message ?? "",
        fields: fields ?? null,
        body,
      });
    }
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      const fields = {};
      for (const item of body.errors) {
        if (item.param) (fields[item.param] ??= []).push(item.message);
      }
      return new ApiError({
        status,
        code: body.errors[0].code ?? "server_error",
        message: body.errors[0].message ?? "",
        fields: Object.keys(fields).length > 0 ? fields : null,
        body,
      });
    }
  }
  return new ApiError({
    status,
    code: status >= 500 ? "server_error" : "request_failed",
    message: "",
    body,
  });
}

/**
 * Send a JSON request.
 * @param {string} method
 * @param {string} path Starts with /api/ or /_allauth/.
 * @param {object} [options]
 * @param {unknown} [options.body] A value that becomes the JSON body.
 * @param {Record<string, string>} [options.headers]
 * @param {boolean} [options.keepalive] Let the request finish after the page closes.
 * @param {AbortSignal} [options.signal]
 * @param {number[]} [options.allowStatuses] Non-2xx statuses that do not throw.
 * @returns {Promise<{ data: any, status: number, headers: Headers }>}
 */
export async function apiRequest(
  method,
  path,
  { body, headers = {}, keepalive = false, signal, allowStatuses = [] } = {},
) {
  const verb = method.toUpperCase();
  const requestHeaders = { Accept: "application/json", ...headers };
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
  if (CSRF_METHODS.has(verb)) {
    const token = getCsrfToken();
    if (token) requestHeaders["X-CSRFToken"] = token;
  }

  let response;
  try {
    response = await fetch(path, {
      method: verb,
      credentials: "same-origin",
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
      signal,
    });
  } catch (cause) {
    if (cause?.name === "AbortError") throw cause;
    throw new ApiError({ status: 0, code: "network_error", message: "" });
  }

  checkRelease(response);
  const data = await readBody(response);

  if (!response.ok && !allowStatuses.includes(response.status)) {
    if (response.status === 401 && path.startsWith("/api/")) unauthorizedHandler?.();
    throw toApiError(response.status, data);
  }
  return { data, status: response.status, headers: response.headers };
}
