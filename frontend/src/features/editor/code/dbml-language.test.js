import { StringStream } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { dbml, dbmlStreamParser } from "./dbml-language.js";

// Run the mode over the lines and return [token text, token name] pairs.
function tokenize(source) {
  const state = dbmlStreamParser.startState();
  const result = [];
  for (const line of source.split("\n")) {
    const stream = new StringStream(line, 2, 2);
    while (!stream.eol()) {
      stream.start = stream.pos;
      const name = dbmlStreamParser.token(stream, state);
      if (name) result.push([stream.current(), name]);
    }
  }
  return result;
}

describe("dbml language", () => {
  it("returns a language support object", () => {
    expect(dbml().language).toBeDefined();
  });

  it("marks the keywords, without case sensitivity", () => {
    const tokens = tokenize("Table users as U\nTABLEGROUP g\nenum e\nindexes");
    const keywords = tokens.filter(([, name]) => name === "keyword").map(([word]) => word);
    expect(keywords).toEqual(["Table", "as", "TABLEGROUP", "enum", "indexes"]);
  });

  it("does not mark a keyword inside a longer name", () => {
    expect(tokenize("tables")).toEqual([["tables", "variableName"]]);
  });

  it("marks the settings inside brackets only", () => {
    const tokens = tokenize("id int [pk, not null, default: 1]\nname");
    const settings = tokens.filter(([, name]) => name === "propertyName").map(([word]) => word);
    expect(settings).toEqual(["pk", "not null", "default"]);
    expect(tokens).toContainEqual(["name", "variableName"]);
  });

  it("marks the multi-word settings as one token", () => {
    const tokens = tokenize("[primary key, set null, no action, set default]");
    const settings = tokens.filter(([, name]) => name === "propertyName").map(([word]) => word);
    expect(settings).toEqual(["primary key", "set null", "no action", "set default"]);
  });

  it("marks the strings", () => {
    expect(tokenize(`'a b' "c d"`)).toEqual([
      ["'a b'", "string"],
      ['"c d"', "string"],
    ]);
  });

  it("marks a backtick expression", () => {
    expect(tokenize("`now()`")).toEqual([["`now()`", "string.special"]]);
  });

  it("continues a multi-line string across lines", () => {
    const tokens = tokenize("Note: '''first\nTable inside\nlast''' Table");
    expect(tokens.filter(([, name]) => name === "string").map(([word]) => word)).toEqual([
      "'''first",
      "Table inside",
      "last'''",
    ]);
    expect(tokens.at(-1)).toEqual(["Table", "keyword"]);
  });

  it("marks the line comments", () => {
    expect(tokenize("Table // a Table")).toEqual([
      ["Table", "keyword"],
      ["// a Table", "comment"],
    ]);
  });

  it("continues a block comment across lines", () => {
    const tokens = tokenize("/* one\nTable\n*/ Ref");
    expect(tokens.map(([, name]) => name)).toEqual(["comment", "comment", "comment", "keyword"]);
  });

  it("closes a block comment on the same line", () => {
    expect(tokenize("/* a */ Ref")).toEqual([
      ["/* a */", "comment"],
      ["Ref", "keyword"],
    ]);
  });

  it("marks the numbers", () => {
    expect(tokenize("varchar(255) 1.5")).toContainEqual(["255", "number"]);
    expect(tokenize("1.5")).toEqual([["1.5", "number"]]);
  });

  it("marks the hex colors", () => {
    expect(tokenize("[headercolor: #abc] #aabbcc")).toEqual(
      expect.arrayContaining([
        ["#abc", "atom"],
        ["#aabbcc", "atom"],
      ]),
    );
  });

  it("marks the ref operators", () => {
    const operators = tokenize(
      "Ref: a.id < b.a_id\nRef: a.id > b.a_id\nRef: a.id - b.id\nRef: a.id <> b.id",
    )
      .filter(([, name]) => name === "operator")
      .map(([op]) => op);
    expect(operators).toEqual(["<", ">", "-", "<>"]);
  });
});
