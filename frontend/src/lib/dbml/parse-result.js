// The parse result is the only shape that the rest of the app sees (DESIGN.md §13.2).
// It has plain JSON values only, because it goes through postMessage.

/**
 * @typedef {object} Column
 * @property {string} name
 * @property {string} type The full type text, for example `varchar(255)`.
 * @property {boolean} pk
 * @property {boolean} notNull
 * @property {boolean} unique
 * @property {boolean} increment
 * @property {string | null} default A short text, for example `now()`, `'active'`, or `0`.
 * @property {string | null} note
 */

/**
 * @typedef {object} Index
 * @property {string[]} columns Column names or expression texts.
 * @property {boolean} unique
 * @property {boolean} pk
 * @property {string | null} name
 * @property {string | null} type
 * @property {string | null} note
 */

/**
 * @typedef {object} Table
 * @property {string} key `<schema>.<name>`
 * @property {string} schema
 * @property {string} name
 * @property {string | null} alias
 * @property {string | null} note
 * @property {string | null} headerColor
 * @property {Column[]} columns
 * @property {Index[]} indexes
 */

/**
 * @typedef {object} RefEnd
 * @property {string} tableKey
 * @property {string[]} columns
 */

/**
 * @typedef {object} Ref
 * @property {string} key The name of the ref, or a text made from the two ends.
 * @property {RefEnd} from
 * @property {RefEnd} to
 * @property {"1-1" | "1-n" | "n-1" | "n-n"} cardinality
 * @property {string | null} onDelete
 * @property {string | null} onUpdate
 */

/**
 * @typedef {object} Enum
 * @property {string} key `<schema>.<name>`
 * @property {string} schema
 * @property {string} name
 * @property {{ name: string, note: string | null }[]} values
 */

/**
 * @typedef {object} Group
 * @property {string} name
 * @property {string[]} tableKeys
 * @property {string | null} color
 */

/**
 * @typedef {object} ParseResult
 * @property {{ name: string | null, note: string | null } | null} project
 * @property {Table[]} tables
 * @property {Ref[]} refs
 * @property {Enum[]} enums
 * @property {Group[]} groups
 */

const DEFAULT_SCHEMA = "public";

/** The key of a table. A missing schema means the default schema. */
function tableKey(schemaName, tableName) {
  return `${schemaName ?? DEFAULT_SCHEMA}.${tableName}`;
}

/** The text of a default value, as the user wrote it in DBML. */
function defaultText(dbdefault) {
  if (!dbdefault) return null;
  const { type, value } = dbdefault;
  if (type === "string") return `'${value}'`;
  return String(value);
}

/** The full type text. An enum type in a schema keeps its schema, so the text names the enum. */
function typeText(type) {
  if (!type) return "";
  return type.schemaName ? `${type.schemaName}.${type.type_name}` : type.type_name;
}

function toColumn(field) {
  return {
    name: field.name,
    type: typeText(field.type),
    pk: Boolean(field.pk),
    notNull: Boolean(field.not_null),
    unique: Boolean(field.unique),
    increment: Boolean(field.increment),
    default: defaultText(field.dbdefault),
    note: field.note ?? null,
  };
}

function toIndex(index) {
  return {
    columns: (index.columns ?? []).map((column) => column.value),
    unique: Boolean(index.unique),
    pk: Boolean(index.pk),
    name: index.name ?? null,
    type: index.type ?? null,
    note: index.note ?? null,
  };
}

function toTable(schemaName, table) {
  return {
    key: tableKey(schemaName, table.name),
    schema: schemaName,
    name: table.name,
    alias: table.alias ?? null,
    note: table.note ?? null,
    headerColor: table.headerColor ?? null,
    columns: (table.fields ?? []).map(toColumn),
    indexes: (table.indexes ?? []).map(toIndex),
  };
}

/** True if the relation of an endpoint is the "many" side: `*`, `0..*`, `1..*`, or a number above 1. */
function isMany(relation) {
  const text = String(relation);
  if (text === "*" || text.endsWith("..*")) return true;
  const max = Number(text.split("..").pop());
  return Number.isFinite(max) && max > 1;
}

function toRefEnd(endpoint) {
  return {
    tableKey: tableKey(endpoint.schemaName, endpoint.tableName),
    columns: [...endpoint.fieldNames],
  };
}

function toRef(ref) {
  const [first, second] = ref.endpoints;
  const from = toRefEnd(first);
  const to = toRefEnd(second);
  const cardinality = `${isMany(first.relation) ? "n" : "1"}-${isMany(second.relation) ? "n" : "1"}`;
  return {
    key:
      ref.name ??
      `${from.tableKey}(${from.columns.join(",")})-${to.tableKey}(${to.columns.join(",")})`,
    from,
    to,
    cardinality,
    onDelete: ref.onDelete ?? null,
    onUpdate: ref.onUpdate ?? null,
  };
}

function toEnum(schemaName, enumObject) {
  return {
    key: `${schemaName}.${enumObject.name}`,
    schema: schemaName,
    name: enumObject.name,
    values: (enumObject.values ?? []).map((value) => ({
      name: value.name,
      note: value.note ?? null,
    })),
  };
}

function toGroup(group) {
  return {
    name: group.name,
    tableKeys: (group.tables ?? []).map((table) => tableKey(table.schemaName, table.tableName)),
    color: group.color ?? null,
  };
}

/**
 * Change a database object of `@dbml/core` to a ParseResult.
 * @param {{ name?: string, note?: string, export: () => any }} database
 * @returns {ParseResult}
 */
export function toParseResult(database) {
  const raw = database.export();
  const result = { project: null, tables: [], refs: [], enums: [], groups: [] };
  // A source without a Project block gives no project.
  if (database.name || database.note) {
    result.project = { name: database.name ?? null, note: database.note ?? null };
  }
  for (const schema of raw.schemas) {
    result.tables.push(...schema.tables.map((table) => toTable(schema.name, table)));
    result.enums.push(...schema.enums.map((item) => toEnum(schema.name, item)));
    result.groups.push(...schema.tableGroups.map(toGroup));
    // A ref that crosses schemas is in the default schema, so read the refs of all schemas.
    result.refs.push(...schema.refs.map(toRef));
  }
  return result;
}
