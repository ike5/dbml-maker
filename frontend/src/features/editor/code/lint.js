import { Text } from "@codemirror/state";

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toPosition(doc, lineNumber, column) {
  const line = doc.line(clamp(Math.trunc(lineNumber) || 1, 1, doc.lines));
  return line.from + clamp((Math.trunc(column) || 1) - 1, 0, line.length);
}

function endOfWord(doc, from) {
  const line = doc.lineAt(from);
  let to = from;
  while (to < line.to && WORD_CHAR.test(doc.sliceString(to, to + 1))) to += 1;
  // At a non-word character, the mark covers one character.
  if (to === from) to = Math.min(from + 1, line.to);
  return to;
}

/**
 * Change parse errors into CodeMirror diagnostics (EDT-002).
 * The parser gives line and column numbers that start at 1. The messages stay
 * plain text, because the lint panel never renders HTML (EDT-005).
 *
 * @param {string | Text} doc The document.
 * @param {Array<{message: string, line: number, column: number, endLine?: number, endColumn?: number}>} errors
 */
export function toDiagnostics(doc, errors) {
  const text = typeof doc === "string" ? Text.of(doc.split("\n")) : doc;
  return (errors ?? []).map((error) => {
    const from = toPosition(text, error.line, error.column);
    let to = from;
    if (error.endLine != null && error.endColumn != null) {
      to = toPosition(text, error.endLine, error.endColumn);
    }
    if (to <= from) to = endOfWord(text, from);
    return { from, to, severity: "error", message: String(error.message) };
  });
}
