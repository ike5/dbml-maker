// The message handler of the worker. It is a separate module, so that the tests can call it
// without a real worker.
import { exportSqlSource, importSqlText, parseSource } from "./core.js";

const OPERATIONS = {
  parse: (source) => parseSource(source),
  exportSql: (source, dialect) => exportSqlSource(source, dialect),
  importSql: (sql, dialect) => importSqlText(sql, dialect),
};

/**
 * @param {{ id: number, op: string, args: unknown[] }} message
 * @returns {{ id: number, ok: true, value: unknown } | { id: number, ok: false, error: { message: string, parseErrors: unknown[] } }}
 */
export function handleMessage({ id, op, args }) {
  try {
    const operation = OPERATIONS[op];
    if (!operation) throw new Error(`Unknown operation: ${op}`);
    return { id, ok: true, value: operation(...args) };
  } catch (error) {
    return {
      id,
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        parseErrors: error?.parseErrors ?? [],
      },
    };
  }
}
