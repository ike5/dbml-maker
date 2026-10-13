// The parser worker. The UI thread never runs the parser (EDT-001).
import { handleMessage } from "./handler.js";

self.onmessage = (event) => {
  self.postMessage(handleMessage(event.data));
};
