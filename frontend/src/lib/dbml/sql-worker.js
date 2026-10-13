// The SQL worker. It imports `@dbml/core` for the export and the import of SQL. The page starts
// it at the first export or import, and not before (DESIGN.md §13.1).
import { handleSqlMessage } from "./sql-handler.js";

self.onmessage = (event) => {
  self.postMessage(handleSqlMessage(event.data));
};
