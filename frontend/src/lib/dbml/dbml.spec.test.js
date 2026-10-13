import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleParseMessage } from "./parse-handler.js";
import { handleSqlMessage } from "./sql-handler.js";

const DIR = dirname(fileURLToPath(import.meta.url));

/** A fake worker that runs the handler of its file in the same thread and keeps the URL for the tests. */
class FakeWorker {
  static instances = [];

  constructor(url, options) {
    this.url = url;
    this.options = options;
    FakeWorker.instances.push(this);
  }

  postMessage(message) {
    // The URL of the worker tells which handler to use.
    const handle = String(this.url).includes("parse-worker")
      ? handleParseMessage
      : handleSqlMessage;
    const response = handle(message);
    queueMicrotask(() => this.onmessage?.({ data: response }));
  }

  terminate() {}
}

let exportSql, importSql, parse;

// A new module for each test gives a new worker.
beforeEach(async () => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.resetModules();
  ({ exportSql, importSql, parse } = await import("./index.js"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const SOURCE = "Table users {\n  id integer [pk]\n}\n";

describe("DBML module", () => {
  it("EDT-001 parse runs in a Web Worker", async () => {
    await parse(SOURCE);
    expect(FakeWorker.instances).toHaveLength(1);
    const [worker] = FakeWorker.instances;
    expect(String(worker.url)).toMatch(/parse-worker\.js(\?|$)/);
    expect(worker.options).toEqual({ type: "module" });

    // A parse does not start the SQL worker. It starts at the first export.
    await exportSql(SOURCE, "postgres");
    expect(FakeWorker.instances).toHaveLength(2);
    expect(String(FakeWorker.instances[1].url)).toMatch(/sql-worker\.js(\?|$)/);
    expect(FakeWorker.instances[1].options).toEqual({ type: "module" });

    // The main module must not contain a parser. Only the workers import them.
    const text = readFileSync(join(DIR, "index.js"), "utf8");
    const imports = [
      ...text.matchAll(/^\s*(?:import|export)\b[^;]*?from\s+["']([^"']+)["']/gm),
    ].map((match) => match[1]);
    expect(imports).toEqual(["./errors.js"]);
  });

  it("EDT-001 the parse worker does not load @dbml/core", () => {
    // The files of the parse worker, and the files that they import in this folder.
    const files = [
      "parse-worker.js",
      "parse-handler.js",
      "parse-core.js",
      "raw-db.js",
      "handler.js",
    ];
    for (const file of files) {
      const text = readFileSync(join(DIR, file), "utf8");
      expect(text).not.toMatch(/from\s+["']@dbml\/core/);
      expect(text).not.toMatch(/from\s+["']\.\/sql-/);
    }
  });

  it("EDT-002 a parse error gives the line and the column", async () => {
    const { result, errors } = await parse("Table users {\n  id integer\n  name\n}\n");
    expect(result).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      message: "A column must have a type",
      line: 3,
      column: 3,
      endLine: 3,
      endColumn: 7,
    });
  });

  it("IMX-001 export gives SQL for PostgreSQL, MySQL, SQL Server, and Oracle", async () => {
    expect(await exportSql(SOURCE, "postgres")).toContain('CREATE TABLE "users"');
    expect(await exportSql(SOURCE, "mysql")).toContain("CREATE TABLE `users`");
    expect(await exportSql(SOURCE, "mssql")).toContain("CREATE TABLE [users]");
    expect(await exportSql(SOURCE, "oracle")).toContain('CREATE TABLE "users"');
  });

  it("IMX-003 import makes DBML from PostgreSQL, MySQL, and SQL Server", async () => {
    const inputs = {
      postgres: "CREATE TABLE users (id integer PRIMARY KEY);",
      mysql: "CREATE TABLE `users` (`id` int NOT NULL, PRIMARY KEY (`id`));",
      mssql: "CREATE TABLE [users] ([id] int PRIMARY KEY);",
    };
    for (const [dialect, sql] of Object.entries(inputs)) {
      const dbml = await importSql(sql, dialect);
      const { result, errors } = await parse(dbml);
      expect(errors).toEqual([]);
      expect(result.tables.map((table) => table.name)).toEqual(["users"]);
    }
  });

  it("IMX-004 import and export send no network request", async () => {
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("XMLHttpRequest", xhrSpy);

    await exportSql(SOURCE, "postgres");
    await importSql("CREATE TABLE users (id integer);", "postgres");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });
});
