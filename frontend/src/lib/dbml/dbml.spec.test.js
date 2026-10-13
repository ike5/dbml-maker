import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleMessage } from "./handler.js";

const DIR = dirname(fileURLToPath(import.meta.url));

/** A fake worker that runs the handler in the same thread and keeps the URL for the tests. */
class FakeWorker {
  static instances = [];

  constructor(url, options) {
    this.url = url;
    this.options = options;
    FakeWorker.instances.push(this);
  }

  postMessage(message) {
    const response = handleMessage(message);
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
    expect(String(worker.url)).toMatch(/worker\.js(\?|$)/);
    expect(worker.options).toEqual({ type: "module" });

    // The main module must not contain the parser. Only the worker imports it.
    const text = readFileSync(join(DIR, "index.js"), "utf8");
    const imports = [
      ...text.matchAll(/^\s*(?:import|export)\b[^;]*?from\s+["']([^"']+)["']/gm),
    ].map((match) => match[1]);
    expect(imports).toEqual(["./errors.js"]);
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
