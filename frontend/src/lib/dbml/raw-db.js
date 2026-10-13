// Map the raw database of `@dbml/parse` to a ParseResult (DESIGN.md §13.1, §13.2).
// `@dbml/core` normalizes the same raw database in its `Database` class. That class pulls in
// the grammars of all SQL dialects, so the parse worker does not use it. This file copies only
// the normalization that changes the ParseResult. The test `parse-compare.test.js` compares the
// two paths. Only the parse worker imports `@dbml/parse` here (ESLint rule `dbmlOnly`).
import { getMultiplicities } from "@dbml/parse";

const DEFAULT_SCHEMA = "public";

/** The key of a table. A missing schema means the default schema. */
function tableKey(schemaName, tableName) {
  return `${schemaName ?? DEFAULT_SCHEMA}.${tableName}`;
}

/** The text of a note. A raw note is `{ value }`, but a short form can be a text. */
function noteText(note) {
  if (note === null || note === undefined) return null;
  return typeof note === "string" ? note : (note.value ?? null);
}

/** The text of a default value, as the user wrote it in DBML. */
function defaultText(dbdefault) {
  if (!dbdefault) return null;
  const { type, value } = dbdefault;
  if (type === "string") return `'${value}'`;
  return String(value);
}

/**
 * The full type text. A type with a schema keeps its schema, so that the text names the enum.
 * The type object is shared by all tables that use a partial, so this function never changes it.
 */
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
    note: noteText(field.note),
  };
}

function toIndex(index) {
  return {
    columns: (index.columns ?? []).map((column) => column.value),
    unique: Boolean(index.unique),
    pk: Boolean(index.pk),
    name: index.name ?? null,
    type: index.type ?? null,
    note: noteText(index.note),
  };
}

/**
 * Put the fields, the indexes, the note, and the header color of the partials in a table.
 * A field of the table wins over a field of a partial. Of two partials, the one with the higher
 * position wins. A partial is the model for the fields only: `@dbml/core` does the same.
 * @returns {{ fields: any[], indexes: any[], note: string | null, headerColor: string | null, refs: any[] }}
 *   The `refs` are the inline refs of the injected fields.
 */
function applyPartials(table, partialsByName, schemaName) {
  let note = noteText(table.note);
  let headerColor = table.headerColor ?? null;
  const partials = table.partials ?? [];
  if (partials.length === 0) {
    return {
      fields: table.fields ?? [],
      indexes: table.indexes ?? [],
      note,
      headerColor,
      refs: [],
    };
  }

  const fields = [...(table.fields ?? [])];
  const names = new Set(fields.map((field) => field.name));
  const indexes = [];
  const refs = [];
  // One place holder for each partial. The partial with the highest position comes first, so
  // that the positions of the other partials stay valid.
  const ordered = [...partials].sort((a, b) => b.order - a.order);
  for (const partial of [...ordered].reverse()) fields.splice(partial.order, 0, null);

  let noteIsSet = note !== null;
  let colorIsSet = headerColor !== null;
  for (const partial of ordered) {
    const definition = partialsByName.get(partial.name);
    if (!definition) {
      // The compiler reports an unknown partial, so this case only protects the code.
      fields.splice(partial.order, 1);
      continue;
    }
    const added = (definition.fields ?? [])
      .filter((field) => !names.has(field.name))
      .map((field) => {
        names.add(field.name);
        for (const inline of field.inline_refs ?? []) {
          const [own, other] = getMultiplicities(inline.relation) ?? ["*", "*"];
          refs.push({
            name: null,
            schemaName: null,
            endpoints: [
              { schemaName, tableName: table.name, fieldNames: [field.name], relation: own },
              {
                schemaName: inline.schemaName,
                tableName: inline.tableName,
                fieldNames: inline.fieldNames,
                relation: other,
              },
            ],
          });
        }
        return field;
      });
    fields.splice(partial.order, 1, ...added);

    const partialNote = noteText(definition.note);
    if (!noteIsSet && partialNote !== null) {
      note = partialNote;
      noteIsSet = true;
    }
    if (!colorIsSet && definition.headerColor != null) {
      headerColor = definition.headerColor;
      colorIsSet = true;
    }
    indexes.push(...(definition.indexes ?? []));
  }
  // The indexes of the table come after the indexes of the partials.
  indexes.push(...(table.indexes ?? []));
  return { fields, indexes, note, headerColor, refs };
}

function toTable(table, schemaName, partialsByName) {
  const applied = applyPartials(table, partialsByName, schemaName);
  return {
    result: {
      key: tableKey(schemaName, table.name),
      schema: schemaName,
      name: table.name,
      alias: table.alias ?? null,
      note: applied.note,
      headerColor: applied.headerColor,
      columns: applied.fields.map(toColumn),
      indexes: applied.indexes.map(toIndex),
    },
    refs: applied.refs,
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

/** A text for the two ends of a ref. The same fields in the other order give the same text. */
function endpointId(endpoint) {
  const fields = [...endpoint.fieldNames].sort().join(",");
  return `${tableKey(endpoint.schemaName, endpoint.tableName)}(${fields})`;
}

function sameEnds(a, b) {
  const [a1, a2] = a.endpoints.map(endpointId);
  const [b1, b2] = b.endpoints.map(endpointId);
  return (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
}

function toEnum(schemaName, enumObject) {
  return {
    key: `${schemaName}.${enumObject.name}`,
    schema: schemaName,
    name: enumObject.name,
    values: (enumObject.values ?? []).map((value) => ({
      name: value.name,
      note: noteText(value.note),
    })),
  };
}

function toGroup(group) {
  return {
    name: group.name,
    tableKeys: (group.tables ?? []).map((table) => tableKey(table.schemaName, table.name)),
    color: group.color ?? null,
  };
}

/**
 * Change the raw database of `@dbml/parse` to a ParseResult.
 * The result lists the items by schema, in the order in which `@dbml/core` makes the schemas:
 * the schemas of the enums, then of the tables, then of the refs, and then of the table groups.
 * @param {any} raw The value that `compiler.parse.rawDb` gives.
 * @returns {import("./parse-result.js").ParseResult}
 */
export function fromRawDb(raw) {
  const schemaOrder = [];
  const buckets = new Map();
  const bucket = (name) => {
    const schemaName = name ?? DEFAULT_SCHEMA;
    if (!buckets.has(schemaName)) {
      buckets.set(schemaName, { tables: [], enums: [], groups: [], refs: [] });
      schemaOrder.push(schemaName);
    }
    return buckets.get(schemaName);
  };

  const partialsByName = new Map((raw.tablePartials ?? []).map((item) => [item.name, item]));

  for (const schema of raw.schemas ?? []) bucket(schema.name);
  for (const item of raw.enums ?? []) {
    bucket(item.schemaName).enums.push(toEnum(item.schemaName ?? DEFAULT_SCHEMA, item));
  }
  const injectedRefs = [];
  for (const table of raw.tables ?? []) {
    const schemaName = table.schemaName ?? DEFAULT_SCHEMA;
    const mapped = toTable(table, schemaName, partialsByName);
    bucket(table.schemaName).tables.push(mapped.result);
    injectedRefs.push(...mapped.refs);
  }
  const explicitRefs = raw.refs ?? [];
  for (const ref of explicitRefs) {
    bucket(ref.schemaName).refs.push(toRef(ref));
    for (const endpoint of ref.endpoints) bucket(endpoint.schemaName);
  }
  for (const group of raw.tableGroups ?? []) {
    bucket(group.schemaName).groups.push(toGroup(group));
  }
  // A ref from a partial is in the default schema. It is not new if a ref has the same ends.
  const known = [...explicitRefs];
  for (const ref of injectedRefs) {
    if (!known.some((item) => sameEnds(item, ref))) bucket(null).refs.push(toRef(ref));
    known.push(ref);
  }

  const result = { project: null, tables: [], refs: [], enums: [], groups: [] };
  const project = raw.project ?? {};
  const projectNote = noteText(project.note);
  // A source without a Project block gives no project.
  if (project.name || projectNote) {
    result.project = { name: project.name ?? null, note: projectNote };
  }
  for (const name of schemaOrder) {
    const items = buckets.get(name);
    result.tables.push(...items.tables);
    result.enums.push(...items.enums);
    result.groups.push(...items.groups);
    // A ref that crosses schemas is in the default schema, so the refs come from all schemas.
    result.refs.push(...items.refs);
  }
  return result;
}
