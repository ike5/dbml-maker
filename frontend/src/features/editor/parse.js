// Parse scheduling (EDT-001, EDT-002, DESIGN.md §12.6, §13.2).
// The parser runs in a Web Worker. This module only decides when to call it.
import { text } from "../../text/en.js";

export const PARSE_DELAY_MS = 250;

/**
 * Parse the source 250 ms after its last change. Parse at once at each load.
 * @param {object} options
 * @param {ReturnType<typeof import("./store.js").createEditorStore>} options.store
 * @param {(source: string) => Promise<{ result: any, errors: any[] }>} options.parse
 * @param {number} [options.delay]
 * @returns {{ start: () => void, stop: () => void }}
 */
export function createParseScheduler({ store, parse, delay = PARSE_DELAY_MS }) {
  let timer = null;
  let sequence = 0;
  let unsubscribe = null;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  function run() {
    clear();
    const mine = ++sequence;
    parse(store.getState().source).then(
      (parsed) => {
        // A newer request exists, so this answer is old.
        if (mine === sequence) store.getState().setParse(parsed);
      },
      () => {
        if (mine !== sequence) return;
        // The worker failed. Show the failure at the start of the source.
        store.getState().setParse({
          result: null,
          errors: [
            { message: text.editor.parseFailed, line: 1, column: 1, endLine: 1, endColumn: 1 },
          ],
        });
      },
    );
  }

  return {
    start() {
      if (unsubscribe) return;
      run();
      unsubscribe = store.subscribe((state, previous) => {
        if (state.generation !== previous.generation) run();
        else if (state.source !== previous.source) {
          clear();
          timer = setTimeout(run, delay);
        }
      });
    },
    stop() {
      unsubscribe?.();
      unsubscribe = null;
      clear();
      sequence++;
    },
  };
}
