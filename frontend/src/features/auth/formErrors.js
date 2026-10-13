import { text } from "../../text/en.js";

/**
 * The first message of a field error. If the field error has a known code, this
 * gives the text of the code. If not, it gives the message of the server.
 * @param {{ fields?: Record<string, string[]> | null, fieldCodes?: Record<string, string[]> | null } | null | undefined} error
 * @param {string} name
 * @returns {string | undefined}
 */
export function fieldError(error, name) {
  const code = error?.fieldCodes?.[name]?.[0];
  if (code && Object.hasOwn(text.errors.byCode, code)) return text.errors.byCode[code];
  return error?.fields?.[name]?.[0];
}

/**
 * Give the error for FormError: the error, if no field of the form shows it.
 * @param {{ fields?: Record<string, string[]> | null } | null | undefined} error
 * @param {string[]} names The names of the fields of the form.
 */
export function formLevelError(error, names) {
  if (!error) return null;
  return names.some((name) => fieldError(error, name)) ? null : error;
}
