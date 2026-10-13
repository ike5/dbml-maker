import ELK from "elkjs/lib/elk-api.js";
import ElkWorker from "elkjs/lib/elk-worker.min.js?worker";

let instance = null;

/**
 * Give the shared ELK instance. The layout code runs in a Web Worker, so the UI thread does not
 * stop during the layout of a large diagram (DESIGN.md §12.7). The instance is made at the first call.
 */
export function getElk() {
  instance ??= new ELK({ workerFactory: () => new ElkWorker() });
  return instance;
}
