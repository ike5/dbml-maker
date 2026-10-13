// TEST ONLY. The old parse path: the `Parser` of `@dbml/core` builds a `Database`, and this file
// maps the database to a ParseResult. The production code does not use this file, because the
// parse worker imports `@dbml/parse` alone (DESIGN.md §13.1). The test `parse-compare.test.js`
// compares this path with the path of the worker.
import { Parser } from "@dbml/core";
import { toParseErrors } from "./errors.js";

const DEFAULT_SCHEMA = "public";

function tableKey(schemaName, tableName) {
  return `${schemaName ?? DEFAULT_SCHEMA}.${tableName}`;
}

function defaultText(dbdefault) {
  if (!dbdefault) return null;
  const { type, value } = dbdefault;
  if (type === "string") return `'${value}'`;
  return String(value);
}

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
 * Change a `Database` object of `@dbml/core` to a ParseResult.
 * @param {{ name?: string, note?: string, export: () => any }} database
 * @returns {import("./parse-result.js").ParseResult}
 */
export function toParseResult(database) {
  const raw = database.export();
  const result = { project: null, tables: [], refs: [], enums: [], groups: [] };
  if (database.name || database.note) {
    result.project = { name: database.name ?? null, note: database.note ?? null };
  }
  for (const schema of raw.schemas) {
    result.tables.push(...schema.tables.map((table) => toTable(schema.name, table)));
    result.enums.push(...schema.enums.map((item) => toEnum(schema.name, item)));
    result.groups.push(...schema.tableGroups.map(toGroup));
    result.refs.push(...schema.refs.map(toRef));
  }
  return result;
}

/**
 * Parse DBML source with the `Parser` of `@dbml/core`.
 * @param {string} source
 * @returns {{ result: import("./parse-result.js").ParseResult | null, errors: import("./errors.js").ParseError[] }}
 */
export function legacyParseSource(source) {
  let database;
  try {
    // "dbmlv2" is the current DBML parser. The legacy parser has different error positions.
    database = new Parser().parse(source, "dbmlv2");
  } catch (error) {
    return { result: null, errors: toParseErrors(error) };
  }
  return { result: toParseResult(database), errors: [] };
}
