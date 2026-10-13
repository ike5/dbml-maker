import { useId, useState } from "react";
import { Banner, Button, Dialog, Select, Spinner } from "../../ui/index.js";
import { DbmlError, exportSql } from "../../lib/dbml/index.js";
import { text } from "../../text/en.js";
import { safeBaseName } from "./file-name.js";
import { saveFile } from "./save-file.js";
import { ErrorList } from "./ErrorList.jsx";
import "./import-export.css";

/**
 * @typedef {object} ExportDialogProps
 * @property {string} name The name of the diagram. It gives the file name.
 * @property {string} source The DBML source.
 * @property {(format: "png" | "svg") => Promise<Blob | string>} exportImage Made by the editor.
 *   The feature does not import the canvas (DESIGN.md §12.10).
 * @property {() => void} onClose
 */

const FORMATS = {
  dbml: { extension: ".dbml", mime: "text/plain" },
  postgres: { extension: ".postgres.sql", mime: "application/sql", dialect: "postgres" },
  mysql: { extension: ".mysql.sql", mime: "application/sql", dialect: "mysql" },
  mssql: { extension: ".mssql.sql", mime: "application/sql", dialect: "mssql" },
  oracle: { extension: ".oracle.sql", mime: "application/sql", dialect: "oracle" },
  png: { extension: ".png", mime: "image/png", image: "png" },
  svg: { extension: ".svg", mime: "image/svg+xml", image: "svg" },
};

const OPTIONS = Object.keys(FORMATS).map((value) => ({
  value,
  label: text.importExport.formats[value],
}));

/** @param {ExportDialogProps} props */
export function ExportDialog({ name, source, exportImage, onClose }) {
  const formId = useId();
  const [formatId, setFormatId] = useState("dbml");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function run(event) {
    event.preventDefault();
    const format = FORMATS[formatId];
    setError(null);
    setPending(true);
    try {
      let content;
      if (format.dialect) content = await exportSql(source, format.dialect);
      else if (format.image) content = await exportImage(format.image);
      else content = source;
      const blob = content instanceof Blob ? content : new Blob([content], { type: format.mime });
      saveFile(blob, safeBaseName(name) + format.extension);
      setPending(false);
      onClose();
    } catch (caught) {
      setError(caught);
      setPending(false);
    }
  }

  return (
    <Dialog
      title={text.importExport.exportTitle}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{text.common.cancel}</Button>
          <Button type="submit" form={formId} variant="primary" disabled={pending}>
            {pending ? (
              <span className="ie-pending">
                <Spinner />
                {text.importExport.exportAction}
              </span>
            ) : (
              text.importExport.exportAction
            )}
          </Button>
        </>
      }
    >
      <form id={formId} className="ie-form" onSubmit={run} noValidate>
        <Select
          label={text.importExport.formatLabel}
          options={OPTIONS}
          value={formatId}
          onChange={(event) => setFormatId(event.target.value)}
          disabled={pending}
        />
        {error instanceof DbmlError ? (
          <Banner kind="error">
            {text.importExport.exportSourceErrors}
            <ErrorList errors={error.parseErrors} />
          </Banner>
        ) : (
          error && <Banner kind="error">{text.importExport.exportFailed}</Banner>
        )}
      </form>
    </Dialog>
  );
}
