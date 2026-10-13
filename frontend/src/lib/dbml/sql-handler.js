// The message handler of the SQL worker.
import { makeHandler } from "./handler.js";
import { exportSqlSource, importSqlText } from "./sql-core.js";

export const handleSqlMessage = makeHandler({
  exportSql: (source, dialect) => exportSqlSource(source, dialect),
  importSql: (sql, dialect) => importSqlText(sql, dialect),
});
