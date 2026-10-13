import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleParseMessage } from "./parse-handler.js";
import { handleSqlMessage } from "./sql-handler.js";

/** A fake worker that runs the message handler of its file in the same thread, but answers later. */
class FakeWorker {
  static instances = [];
  // If true, the SQL worker crashes at each message. The parse worker answers as before.
  static crashSql = false;

  constructor(url, options) {
    this.url = url;
    this.options = options;
    FakeWorker.instances.push(this);
  }

  postMessage(message) {
    if (FakeWorker.crashSql && String(this.url).includes("sql-worker")) {
      queueMicrotask(() => this.onerror?.({ message: "boom" }));
      return;
    }
    // The URL of the worker tells which handler to use.
    const handle = String(this.url).includes("parse-worker")
      ? handleParseMessage
      : handleSqlMessage;
    const response = handle(message);
    queueMicrotask(() => this.onmessage?.({ data: response }));
  }

  terminate() {}
}

let DbmlError, exportSql, importSql, parse;

// The module keeps one worker for its lifetime. A new module for each test gives a new worker.
beforeEach(async () => {
  FakeWorker.instances = [];
  FakeWorker.crashSql = false;
  vi.stubGlobal("Worker", FakeWorker);
  vi.resetModules();
  ({ DbmlError, exportSql, importSql, parse } = await import("./index.js"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parse", () => {
  it("resolves with a result and no errors for a valid source", async () => {
    const { result, errors } = await parse("Table a { id int [pk] }");
    expect(errors).toEqual([]);
    expect(result.tables.map((table) => table.key)).toEqual(["public.a"]);
  });

  it("resolves with errors, not a rejection, for an invalid source", async () => {
    const { result, errors } = await parse("Table {");
    expect(result).toBeNull();
    expect(errors[0]).toMatchObject({ line: 1, column: 8 });
  });

  it("uses one shared worker for all calls", async () => {
    await parse("");
    await parse("");
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("does not start the SQL worker", async () => {
    await parse("");
    expect(FakeWorker.instances.map((worker) => String(worker.url))).toEqual([
      expect.stringMatching(/parse-worker\.js/),
    ]);
  });
});

describe("exportSql", () => {
  it("resolves with SQL text", async () => {
    const sql = await exportSql("Table a { id int [pk] }", "postgres");
    expect(sql).toContain('CREATE TABLE "a"');
  });

  it("rejects with a DbmlError that has parseErrors", async () => {
    const error = await exportSql("Table {", "postgres").catch((caught) => caught);
    expect(error).toBeInstanceOf(DbmlError);
    expect(error.parseErrors[0]).toMatchObject({ line: 1, column: 8 });
  });

  it("rejects an unknown dialect", async () => {
    await expect(exportSql("", "sqlite")).rejects.toBeInstanceOf(DbmlError);
  });
});

describe("workers", () => {
  it("starts the SQL worker at the first export, and shares it with the import", async () => {
    await exportSql("Table a { id int }", "postgres");
    await importSql("CREATE TABLE a (id int);", "postgres");
    expect(FakeWorker.instances).toHaveLength(1);
    expect(String(FakeWorker.instances[0].url)).toMatch(/sql-worker\.js/);
  });

  it("rejects only the pending calls of a crashed worker", async () => {
    FakeWorker.crashSql = true;
    const [parsed, exported] = await Promise.allSettled([
      parse("Table a { id int }"),
      exportSql("Table a { id int }", "postgres"),
    ]);
    expect(parsed.status).toBe("fulfilled");
    expect(exported.status).toBe("rejected");
    expect(exported.reason.message).toBe("boom");
  });
});

describe("importSql", () => {
  it("resolves with DBML source", async () => {
    const dbml = await importSql("CREATE TABLE a (id int PRIMARY KEY);", "postgres");
    expect(dbml).toContain('Table "a"');
  });

  it("rejects with a DbmlError for bad SQL", async () => {
    const error = await importSql("CREATE TABL a (", "postgres").catch((caught) => caught);
    expect(error).toBeInstanceOf(DbmlError);
    expect(error.parseErrors.length).toBeGreaterThan(0);
  });

  it("gives the SQL position of an error with the line and the column from 1", async () => {
    const sql = "CREATE TABLE ok (id int);\n\nCREATE TABL bad (id int);";
    const error = await importSql(sql, "postgres").catch((caught) => caught);
    // "TABL" starts at the 8th character of line 3.
    expect(error.parseErrors[0]).toMatchObject({ line: 3, column: 8 });
  });
});

describe("many calls at the same time", () => {
  it("gives each call its own answer", async () => {
    const sources = Array.from({ length: 20 }, (_, index) => `Table t${index} { id int }`);
    const answers = await Promise.all(sources.map((source) => parse(source)));
    answers.forEach(({ result }, index) => {
      expect(result.tables[0].name).toBe(`t${index}`);
    });
  });

  it("keeps a failure of one call away from the other calls", async () => {
    const [good, bad, sql] = await Promise.allSettled([
      parse("Table a { id int }"),
      exportSql("Table {", "mysql"),
      exportSql("Table b { id int }", "mysql"),
    ]);
    expect(good.status).toBe("fulfilled");
    expect(bad.status).toBe("rejected");
    expect(sql.value).toContain("CREATE TABLE `b`");
  });
});
