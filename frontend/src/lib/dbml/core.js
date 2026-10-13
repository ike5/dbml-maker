// Plain functions that run inside the parser worker. Only this file and the worker import
// `@dbml/core` (DESIGN.md §13.1). The tests call these functions directly.
import { Parser, exporter, importer } from "@dbml/core";
import { DbmlError, toDbmlError, toParseErrors } from "./errors.js";
import { toParseResult } from "./parse-result.js";

const EXPORT_DIALECTS = ["postgres", "mysql", "mssql", "oracle"];
const IMPORT_DIALECTS = ["postgres", "mysql", "mssql"];

function assertDialect(dialect, allowed) {
  if (!allowed.includes(dialect)) {
    throw new DbmlError(`Unknown SQL dialect: ${dialect}`);
  }
}

/**
 * Parse DBML source. If the source has errors, `result` is null.
 * @param {string} source
 * @returns {{ result: import("./parse-result.js").ParseResult | null, errors: import("./errors.js").ParseError[] }}
 */
export function parseSource(source) {
  let database;
  try {
    // "dbmlv2" is the current DBML parser. The legacy parser has different error positions.
    database = new Parser().parse(source, "dbmlv2");
  } catch (error) {
    return { result: null, errors: toParseErrors(error) };
  }
  return { result: toParseResult(database), errors: [] };
}

/**
 * Export DBML source to SQL.
 * @param {string} source
 * @param {string} dialect
 * @returns {string}
 * @throws {DbmlError} If the source has errors.
 */
export function exportSqlSource(source, dialect) {
  assertDialect(dialect, EXPORT_DIALECTS);
  try {
    return exporter.export(source, dialect);
  } catch (error) {
    throw toDbmlError(error);
  }
}

/**
 * Import SQL text to DBML source.
 * @param {string} sql
 * @param {string} dialect
 * @returns {string}
 * @throws {DbmlError} If the SQL has errors.
 */
export function importSqlText(sql, dialect) {
  assertDialect(dialect, IMPORT_DIALECTS);
  try {
    return importer.import(sql, dialect);
  } catch (error) {
    throw toDbmlError(error);
  }
}
