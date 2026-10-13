import {
  HighlightStyle,
  LanguageSupport,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

// The colors come from this mode and not from the parser (DESIGN.md §13.5).
// The mode must work on text that does not parse.

const KEYWORDS = new Set([
  "table",
  "ref",
  "enum",
  "tablegroup",
  "project",
  "note",
  "indexes",
  "as",
]);

const SETTINGS = new Set([
  "pk",
  "unique",
  "null",
  "increment",
  "default",
  "note",
  "ref",
  "delete",
  "update",
  "cascade",
  "restrict",
  "headercolor",
  "name",
  "type",
  "color",
]);

// Multi-word settings come first so that "not null" is one token.
const MULTI_WORD_SETTING = /^(primary\s+key|not\s+null|set\s+null|set\s+default|no\s+action)\b/i;

// Read the rest of a multi-line string. A backslash escapes the next character.
function readMultiString(stream, state) {
  while (!stream.eol()) {
    if (stream.match("'''")) {
      state.multiString = false;
      return;
    }
    if (stream.peek() === "\\") stream.next();
    stream.next();
  }
}

export const dbmlStreamParser = {
  name: "dbml",

  startState() {
    return { blockComment: false, multiString: false, brackets: 0 };
  },

  token(stream, state) {
    if (state.blockComment) {
      if (stream.match(/^.*?\*\//)) state.blockComment = false;
      else stream.skipToEnd();
      return "comment";
    }
    if (state.multiString) {
      readMultiString(stream, state);
      return "string";
    }

    if (stream.eatSpace()) return null;

    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      state.blockComment = true;
      if (stream.match(/^.*?\*\//)) state.blockComment = false;
      else stream.skipToEnd();
      return "comment";
    }

    if (stream.match("'''")) {
      state.multiString = true;
      readMultiString(stream, state);
      return "string";
    }

    const quote = stream.peek();
    if (quote === "'" || quote === '"' || quote === "`") {
      stream.next();
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === "\\") stream.next();
        else if (ch === quote) break;
      }
      return quote === "`" ? "string.special" : "string";
    }

    if (stream.match(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_])/)) return "atom";
    if (stream.match(/^\d+(?:\.\d+)?/)) return "number";

    if (stream.match("<>") || stream.match(/^[<>-]/)) return "operator";

    const ch = stream.peek();
    if (ch === "[") {
      stream.next();
      state.brackets += 1;
      return "bracket";
    }
    if (ch === "]") {
      stream.next();
      if (state.brackets > 0) state.brackets -= 1;
      return "bracket";
    }

    if (state.brackets > 0 && stream.match(MULTI_WORD_SETTING)) return "propertyName";

    if (stream.match(/^[A-Za-z_]\w*/)) {
      const word = stream.current().toLowerCase();
      if (state.brackets > 0) return SETTINGS.has(word) ? "propertyName" : "variableName";
      return KEYWORDS.has(word) ? "keyword" : "variableName";
    }

    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
  },
};

export const dbmlLanguage = StreamLanguage.define(dbmlStreamParser);

// Fixed colors keep the code readable on the light theme of global.css.
export const dbmlHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#2f5bea", fontWeight: "600" },
  { tag: tags.propertyName, color: "#8a4fbf" },
  { tag: tags.string, color: "#1a7f4b" },
  { tag: tags.special(tags.string), color: "#b45f06" },
  { tag: tags.comment, color: "#7a8396", fontStyle: "italic" },
  { tag: tags.number, color: "#b45f06" },
  { tag: tags.atom, color: "#b45f06" },
  { tag: tags.operator, color: "#c62828", fontWeight: "600" },
  { tag: tags.bracket, color: "#5b6475" },
]);

export function dbml() {
  return new LanguageSupport(dbmlLanguage, [syntaxHighlighting(dbmlHighlightStyle)]);
}
