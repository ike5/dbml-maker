// The message handler of the parse worker.
import { makeHandler } from "./handler.js";
import { parseSource } from "./parse-core.js";

export const handleParseMessage = makeHandler({
  parse: (source) => parseSource(source),
});
