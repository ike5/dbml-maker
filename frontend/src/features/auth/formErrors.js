/**
 * The first message of a field error.
 * @param {{ fields?: Record<string, string[]> | null } | null | undefined} error
 * @param {string} name
 * @returns {string | undefined}
 */
export function fieldError(error, name) {
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
