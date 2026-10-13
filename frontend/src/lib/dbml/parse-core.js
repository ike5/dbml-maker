// Plain functions that run inside the parse worker. Only this file and `raw-db.js` import
// `@dbml/parse`, and nothing in the parse worker imports `@dbml/core` (DESIGN.md §13.1).
// The tests call these functions directly.
import { Compiler, DEFAULT_ENTRY, MemoryProjectLayout } from "@dbml/parse";
import { fromRawDb } from "./raw-db.js";

/**
 * Change one diagnostic of `@dbml/parse` to a ParseError. The positions of the compiler start
 * from 0, and a ParseError starts from 1 (EDT-002).
 */
function toParseError(error) {
  const { startPos, endPos } = error.nodeOrToken;
  return {
    message: error.diagnostic,
    line: startPos.line + 1,
    column: startPos.column + 1,
    endLine: endPos.line + 1,
    endColumn: endPos.column + 1,
  };
}

/**
 * Parse DBML source. If the source has errors, `result` is null.
 * @param {string} source
 * @returns {{ result: import("./parse-result.js").ParseResult | null, errors: import("./errors.js").ParseError[] }}
 */
export function parseSource(source) {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, source);
  const compiler = new Compiler(layout);
  const errors = compiler.parse.errors(DEFAULT_ENTRY).map(toParseError);
  if (errors.length > 0) return { result: null, errors };
  return { result: fromRawDb(compiler.parse.rawDb(DEFAULT_ENTRY)), errors: [] };
}
