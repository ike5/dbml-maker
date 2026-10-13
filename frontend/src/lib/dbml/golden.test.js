// Golden tests for the DBML module (DESIGN.md §15.2).
// Write the expected files again, then read the changes in git before you accept them:
//   UPDATE_GOLDEN=1 npx vitest --run src/lib/dbml/golden.test.js && npx prettier --write src/lib/dbml
// Prettier formats the JSON files, so the tests compare JSON values and not text.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exportSqlSource, importSqlText, parseSource } from "./core.js";
import { EXPORT_DIALECTS, IMPORT_DIALECTS } from "./index.js";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
/* global process */
const UPDATE = process.env.UPDATE_GOLDEN === "1";

const read = (...parts) => readFileSync(join(FIXTURES, ...parts), "utf8");
const names = (dir, suffix) =>
  readdirSync(join(FIXTURES, dir))
    .filter((file) => file.endsWith(suffix))
    .map((file) => file.slice(0, -suffix.length));

/** Compare with an expected file, or write the file in update mode. */
function expectGolden(text, ...parts) {
  if (UPDATE) writeFileSync(join(FIXTURES, ...parts), text);
  expect(text).toBe(read(...parts));
}

/** Compare a value with an expected JSON file, or write the file in update mode. */
function expectGoldenJson(value, ...parts) {
  if (UPDATE) writeFileSync(join(FIXTURES, ...parts), `${JSON.stringify(value, null, 2)}\n`);
  expect(value).toEqual(JSON.parse(read(...parts)));
}

describe("parse fixtures", () => {
  it.each(names("", ".dbml"))("%s gives the expected parse result", (name) => {
    const { result, errors } = parseSource(read(`${name}.dbml`));
    expect(errors).toEqual([]);
    expectGoldenJson(result, `${name}.result.json`);
  });
});

describe("export fixtures", () => {
  const cases = names("", ".dbml").flatMap((name) =>
    EXPORT_DIALECTS.map((dialect) => [name, dialect]),
  );
  it.each(cases)("%s gives the expected SQL for %s", (name, dialect) => {
    expectGolden(exportSqlSource(read(`${name}.dbml`), dialect), `${name}.${dialect}.sql`);
  });
});

describe("error fixtures", () => {
  it.each(names("errors", ".dbml"))("%s gives the expected errors", (name) => {
    const { result, errors } = parseSource(read("errors", `${name}.dbml`));
    expect(result).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
    expectGoldenJson(errors, "errors", `${name}.errors.json`);
  });
});

describe("import fixtures", () => {
  const cases = IMPORT_DIALECTS.flatMap((dialect) =>
    names("import", `.${dialect}.sql`).map((name) => [name, dialect]),
  );
  it.each(cases)("%s gives the expected DBML for %s", (name, dialect) => {
    const dbml = importSqlText(read("import", `${name}.${dialect}.sql`), dialect);
    expectGolden(dbml, "import", `${name}.${dialect}.dbml`);
    // The new DBML must parse, so that a user can open an import result.
    expect(parseSource(dbml).errors).toEqual([]);
  });
});
