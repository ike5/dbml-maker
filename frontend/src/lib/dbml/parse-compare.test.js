// The parse worker reads the raw database of `@dbml/parse` and normalizes it itself
// (DESIGN.md §13.1). These tests make sure that its result equals the result of the old path,
// where `@dbml/core` builds a `Database` (`legacy-parse.js`, test only).
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { legacyParseSource } from "./legacy-parse.js";
import { parseSource } from "./parse-core.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");

const fixtureSources = (dir) =>
  readdirSync(join(FIXTURES, dir))
    .filter((file) => file.endsWith(".dbml"))
    .map((file) => [`${dir}/${file}`, readFileSync(join(FIXTURES, dir, file), "utf8")]);

// Sources for the cases that the fixtures do not cover.
const EXTRA_SOURCES = {
  "no project": "Table a { id int [pk] }",
  "note only project": "Project { Note: 'Only a note.' }",
  "table partial": `
TablePartial timestamps [note: 'Partial note', headercolor: #111111] {
  created_at timestamp [default: \`now()\`]
  owner_id integer [ref: > users.id]
  indexes { created_at }
}
TablePartial audit {
  updated_by integer
  created_at timestamp
}
Table users { id integer [pk] }
Table posts [note: 'Own note'] {
  id integer [pk]
  ~timestamps
  title text
  ~audit
  indexes { title }
}
Table comments {
  ~audit
  ~timestamps
  body text
}`,
  "alias in group and ref": `
Table users as U { id integer [pk] }
Table posts { id integer [pk] user_id integer }
TableGroup g { U }
Ref: U.id < posts.user_id`,
  "refs in a schema": `
Table a.x { id int [pk] }
Table b.y { id int [pk] x_id int [ref: > a.x.id] }
Ref named: a.x.id - b.y.id`,
  "enum in the default schema": `
enum kind { a b }
Table t { k kind [default: 'a'] }`,
  cardinality: `
Table a { id int [pk] }
Table b { id int [pk] a_id int }
Ref: b.a_id >? a.id
Ref: a.id ?-? b.id`,
  "composite key ref": `
Table a { x int  y int  indexes { (x, y) [pk] } }
Table b { x int  y int }
Ref: b.(x, y) > a.(x, y)`,
};

describe("the parse worker and the old path", () => {
  const sources = [
    ...fixtureSources("."),
    ...fixtureSources("errors"),
    ...Object.entries(EXTRA_SOURCES),
  ];

  it.each(sources)("%s gives the same result and the same errors", (_name, source) => {
    expect(parseSource(source)).toEqual(legacyParseSource(source));
  });
});

describe("the known difference from the old path", () => {
  it("keeps the schema of an unknown type once", () => {
    // The old path gave "other.other.thing" here. The name of the schema was in the text two times.
    const source = "Table t { id int\n body other.thing }";
    expect(parseSource(source).result.tables[0].columns[1].type).toBe("other.thing");
    expect(legacyParseSource(source).result.tables[0].columns[1].type).toBe("other.other.thing");
  });
});
