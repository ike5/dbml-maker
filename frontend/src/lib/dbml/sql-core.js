// Plain functions that run inside the SQL worker. Only this file imports `@dbml/core`
// (DESIGN.md §13.1). The tests call these functions directly.
import { exporter, importer } from "@dbml/core";
import { DbmlError, toDbmlError } from "./errors.js";

const EXPORT_DIALECTS = ["postgres", "mysql", "mssql", "oracle"];
const IMPORT_DIALECTS = ["postgres", "mysql", "mssql"];

function assertDialect(dialect, allowed) {
  if (!allowed.includes(dialect)) {
    throw new DbmlError(`Unknown SQL dialect: ${dialect}`);
  }
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
