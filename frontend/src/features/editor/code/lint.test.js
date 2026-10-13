import { describe, expect, it } from "vitest";
import { toDiagnostics } from "./lint.js";

const SOURCE = "Table users {\n  id int\n}\n";

describe("toDiagnostics", () => {
  it("changes line and column to document positions", () => {
    const [d] = toDiagnostics(SOURCE, [
      { message: "m", line: 2, column: 3, endLine: 2, endColumn: 5 },
    ]);
    expect(d).toEqual({ from: 16, to: 18, severity: "error", message: "m" });
    expect(SOURCE.slice(d.from, d.to)).toBe("id");
  });

  it("marks to the end of the word if the end is missing", () => {
    const [d] = toDiagnostics(SOURCE, [{ message: "m", line: 1, column: 7 }]);
    expect(SOURCE.slice(d.from, d.to)).toBe("users");
  });

  it("marks to the end of the word if the end equals the start", () => {
    const [d] = toDiagnostics(SOURCE, [
      { message: "m", line: 1, column: 1, endLine: 1, endColumn: 1 },
    ]);
    expect(SOURCE.slice(d.from, d.to)).toBe("Table");
  });

  it("marks one character at a non-word character", () => {
    const [d] = toDiagnostics(SOURCE, [{ message: "m", line: 1, column: 13 }]);
    expect(SOURCE.slice(d.from, d.to)).toBe("{");
  });

  it("marks a range over more than one line", () => {
    const [d] = toDiagnostics(SOURCE, [
      { message: "m", line: 1, column: 13, endLine: 3, endColumn: 2 },
    ]);
    expect(SOURCE.slice(d.from, d.to)).toBe("{\n  id int\n}");
  });

  it("clamps a line after the end of the document", () => {
    const [d] = toDiagnostics("abc", [{ message: "m", line: 99, column: 1 }]);
    expect(d.from).toBe(0);
    expect(d.to).toBe(3);
  });

  it("clamps a column after the end of the line", () => {
    const [d] = toDiagnostics("abc\ndef", [{ message: "m", line: 1, column: 50 }]);
    expect(d.from).toBe(3);
    expect(d.to).toBe(3);
  });

  it("clamps a line and a column below 1", () => {
    const [d] = toDiagnostics("abc", [{ message: "m", line: 0, column: -4 }]);
    expect(d.from).toBe(0);
    expect(d.to).toBe(3);
  });

  it("gives an empty range for an empty document", () => {
    expect(toDiagnostics("", [{ message: "m", line: 1, column: 1 }])).toEqual([
      { from: 0, to: 0, severity: "error", message: "m" },
    ]);
  });

  it("gives an empty list for no errors", () => {
    expect(toDiagnostics(SOURCE, [])).toEqual([]);
    expect(toDiagnostics(SOURCE, undefined)).toEqual([]);
  });

  it("keeps the message as plain text", () => {
    const [d] = toDiagnostics("x", [{ message: "<b>bad</b>", line: 1, column: 1 }]);
    expect(d.message).toBe("<b>bad</b>");
  });
});
