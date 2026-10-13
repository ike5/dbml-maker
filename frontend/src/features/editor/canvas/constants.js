// Sizes of a table node. The CSS in canvas.css uses the same numbers.
// The layout (EDT-004) runs before React Flow measures the nodes, so it needs these numbers.
export const TABLE_SIZE = {
  minWidth: 180,
  maxWidth: 420,
  headerHeight: 32,
  rowHeight: 24,
  bottomPadding: 4,
  paddingX: 10,
  charWidth: 7,
  marksWidth: 44,
  border: 1,
};

// The space between a group box and its tables.
export const GROUP_PADDING = 24;
export const GROUP_LABEL_HEIGHT = 28;

// The empty space between existing tables and new tables (EDT-004).
export const NEW_TABLES_GAP = 80;

// The version of the layout format (DESIGN.md §7.2).
export const LAYOUT_FORMAT = 1;
