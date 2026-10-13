/**
 * Make a safe file name from the name of a diagram (IMX-001, IMX-002).
 * Keep letters, digits, "-", and "_". Change each other character to "-".
 * @param {string} name
 * @returns {string} The name without an extension.
 */
export function safeBaseName(name) {
  const cleaned = name.replace(/[^A-Za-z0-9_-]/g, "-");
  return /[A-Za-z0-9_]/.test(cleaned) ? cleaned : "diagram";
}

/** The size limit of a source in bytes (DESIGN.md §7.1). */
export const MAX_SOURCE_BYTES = 1024 * 1024;

/**
 * @param {string} value
 * @returns {number} The size of the text in UTF-8 bytes.
 */
export function utf8Size(value) {
  return new TextEncoder().encode(value).length;
}
