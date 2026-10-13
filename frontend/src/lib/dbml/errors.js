/**
 * @typedef {object} ParseError
 * @property {string} message
 * @property {number} line The line of the start, from 1.
 * @property {number} column The column of the start, from 1.
 * @property {number} endLine The line of the end, from 1.
 * @property {number} endColumn The column of the end, from 1.
 */

/**
 * An error of the DBML module. The property `parseErrors` gives the places in the text
 * (for an export: in the DBML source; for an import: in the SQL text).
 */
export class DbmlError extends Error {
  /**
   * @param {string} message
   * @param {ParseError[]} [parseErrors]
   */
  constructor(message, parseErrors = []) {
    super(message);
    this.name = "DbmlError";
    this.parseErrors = parseErrors;
  }
}

const FALLBACK_POSITION = { line: 1, column: 1 };

/**
 * Change one diagnostic of `@dbml/core` to a ParseError.
 * The DBML parser gives a `message` and positions from 1 (EDT-002). The SQL parsers (ANTLR)
 * give a `text` and columns from 0. For this reason, the SQL columns get +1.
 */
function toParseError(diag) {
  const columnShift = typeof diag.text === "string" ? 1 : 0;
  const start = diag.location?.start ?? FALLBACK_POSITION;
  const end = diag.location?.end ?? start;
  return {
    message: String(diag.message ?? diag.text ?? "Unknown error"),
    line: start.line,
    column: start.column + columnShift,
    endLine: end.line,
    endColumn: end.column + columnShift,
  };
}

/**
 * Change an error of `@dbml/core` to a list of ParseError.
 * If the error has no location, the list has one error at line 1, column 1.
 * @param {unknown} error
 * @returns {ParseError[]}
 */
export function toParseErrors(error) {
  const diags = /** @type {{ diags?: unknown }} */ (error)?.diags;
  if (Array.isArray(diags) && diags.length > 0) {
    return diags.map(toParseError);
  }
  const message = error instanceof Error ? error.message : String(error);
  return [
    {
      message: message || "Unknown error",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
    },
  ];
}

/**
 * Make a DbmlError from any error of `@dbml/core`.
 * @param {unknown} error
 * @returns {DbmlError}
 */
export function toDbmlError(error) {
  if (error instanceof DbmlError) return error;
  const parseErrors = toParseErrors(error);
  return new DbmlError(parseErrors[0].message, parseErrors);
}
