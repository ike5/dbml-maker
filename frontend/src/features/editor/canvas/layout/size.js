import { TABLE_SIZE as S } from "../constants.js";

/**
 * Estimate the size of a table node from its columns.
 * React Flow measures the real size only after the first render, but elk runs before that.
 * @param {{ name: string, schema?: string, columns: { name: string, type: string }[] }} table
 * @returns {{ width: number, height: number }}
 */
export function estimateSize(table) {
  const title =
    table.schema && table.schema !== "public" ? `${table.schema}.${table.name}` : table.name;
  let longest = title.length;
  for (const column of table.columns) {
    // One space separates the name from the type.
    longest = Math.max(longest, column.name.length + 1 + String(column.type).length);
  }
  const wanted = longest * S.charWidth + 2 * S.paddingX + S.marksWidth;
  const width = Math.min(S.maxWidth, Math.max(S.minWidth, Math.ceil(wanted)));
  const height =
    S.headerHeight + table.columns.length * S.rowHeight + S.bottomPadding + 2 * S.border;
  return { width, height };
}
