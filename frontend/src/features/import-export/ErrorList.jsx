import { text } from "../../text/en.js";
import { format } from "../../text/format.js";

/**
 * A list of parse errors as plain text with line and column (DESIGN.md §4.7).
 * @param {object} props
 * @param {import("../../lib/dbml/index.js").ParseError[]} props.errors
 */
export function ErrorList({ errors }) {
  return (
    <ul className="ie-errors">
      {errors.map((error, index) => (
        <li key={index}>
          {format(text.importExport.errorPosition, {
            line: error.line,
            column: error.column,
            message: error.message,
          })}
        </li>
      ))}
    </ul>
  );
}
