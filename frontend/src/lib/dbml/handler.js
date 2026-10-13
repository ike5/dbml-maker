// The message handler of the workers. It is a separate module, so that the tests can call it
// without a real worker. This file imports no parser, so that each worker bundles only its own.

/**
 * Make the handler of one worker.
 * @param {Record<string, (...args: any[]) => unknown>} operations
 * @returns {(message: { id: number, op: string, args: unknown[] }) =>
 *   { id: number, ok: true, value: unknown } |
 *   { id: number, ok: false, error: { message: string, parseErrors: unknown[] } }}
 */
export function makeHandler(operations) {
  return ({ id, op, args }) => {
    try {
      const operation = operations[op];
      if (!operation) throw new Error(`Unknown operation: ${op}`);
      return { id, ok: true, value: operation(...args) };
    } catch (error) {
      return {
        id,
        ok: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          parseErrors: error?.parseErrors ?? [],
        },
      };
    }
  };
}
