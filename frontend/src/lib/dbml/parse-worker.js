// The parse worker. The UI thread never runs the parser (EDT-001). This worker does not load
// `@dbml/core`, so it is small (DESIGN.md §13.1).
//
// The bundle of `@dbml/parse` has a copy of the platform detection of the Monaco editor. That code
// writes "Unable to resolve platform." only if the global scope has neither `navigator` nor
// `process`. A browser worker always has `navigator`, so the message does not show. It is harmless.
import { handleParseMessage } from "./parse-handler.js";

self.onmessage = (event) => {
  self.postMessage(handleParseMessage(event.data));
};
