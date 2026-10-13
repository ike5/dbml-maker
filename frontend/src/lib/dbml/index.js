// The public interface of the DBML module (DESIGN.md §13.2).
// This file must not import `@dbml/core` or `core.js`. Only the worker imports them, so the
// main bundle does not contain the parser.
import { DbmlError } from "./errors.js";

export { DbmlError };

/** @typedef {import("./parse-result.js").ParseResult} ParseResult */
/** @typedef {import("./errors.js").ParseError} ParseError */

export const EXPORT_DIALECTS = ["postgres", "mysql", "mssql", "oracle"];
export const IMPORT_DIALECTS = ["postgres", "mysql", "mssql"];

/** @type {Worker | null} */
let worker = null;
let nextId = 1;
/** @type {Map<number, { resolve: (value: any) => void, reject: (error: Error) => void }>} */
const pending = new Map();

function failAll(error) {
  for (const { reject } of pending.values()) reject(error);
  pending.clear();
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (event) => {
    const { id, ok, value, error } = event.data;
    const call = pending.get(id);
    if (!call) return;
    pending.delete(id);
    if (ok) call.resolve(value);
    else call.reject(new DbmlError(error.message, error.parseErrors));
  };
  worker.onerror = (event) => {
    // A crashed worker cannot answer. Reject the calls and make a new worker at the next call.
    const crashed = worker;
    worker = null;
    crashed?.terminate();
    failAll(new Error(event.message || "The DBML worker failed."));
  };
  return worker;
}

function call(op, args) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, op, args });
  });
}

/**
 * Parse DBML source in the worker. A source with errors also resolves.
 * @param {string} source
 * @returns {Promise<{ result: ParseResult | null, errors: ParseError[] }>}
 */
export function parse(source) {
  return call("parse", [source]);
}

/**
 * Export DBML source to SQL.
 * @param {string} source
 * @param {"postgres" | "mysql" | "mssql" | "oracle"} dialect
 * @returns {Promise<string>} Rejects with a DbmlError if the source has errors.
 */
export function exportSql(source, dialect) {
  return call("exportSql", [source, dialect]);
}

/**
 * Import SQL text to DBML source.
 * @param {string} sql
 * @param {"postgres" | "mysql" | "mssql"} dialect
 * @returns {Promise<string>} Rejects with a DbmlError if the SQL has errors.
 */
export function importSql(sql, dialect) {
  return call("importSql", [sql, dialect]);
}
