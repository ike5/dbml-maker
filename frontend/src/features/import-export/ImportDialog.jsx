import { useId, useRef, useState } from "react";
import {
  Banner,
  Button,
  Dialog,
  FormError,
  Select,
  Spinner,
  TextArea,
  TextField,
} from "../../ui/index.js";
import { DbmlError, importSql } from "../../lib/dbml/index.js";
import { createDiagram } from "../../lib/api/diagrams.js";
import { text } from "../../text/en.js";
import { MAX_SOURCE_BYTES, utf8Size } from "./file-name.js";
import { ErrorList } from "./ErrorList.jsx";
import "./import-export.css";

/**
 * @typedef {object} ImportDialogProps
 * @property {(diagram: { id: string }) => void} onImported Called with the new diagram.
 * @property {() => void} onClose
 */

// The server limit for the name of a diagram (DESIGN.md §7.1).
const MAX_NAME_LENGTH = 200;

const OPTIONS = ["dbml", "postgres", "mysql", "mssql"].map((value) => ({
  value,
  label: text.importExport.formats[value],
}));

/** @param {ImportDialogProps} props */
export function ImportDialog({ onImported, onClose }) {
  const formId = useId();
  const nameTouched = useRef(false);
  const [formatId, setFormatId] = useState("dbml");
  const [content, setContent] = useState("");
  const [name, setName] = useState(text.importExport.defaultName);
  const [contentError, setContentError] = useState(null);
  const [nameError, setNameError] = useState(null);
  const [sqlErrors, setSqlErrors] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [pending, setPending] = useState(false);

  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSqlErrors(null);
    // Refuse a large file before the browser reads it into memory.
    if (file.size > MAX_SOURCE_BYTES) {
      setContentError(text.importExport.tooLarge);
      return;
    }
    setContent(await file.text());
    setContentError(null);
    if (!nameTouched.current) {
      setName(file.name.replace(/\.[^.]*$/, "") || text.importExport.defaultName);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    setApiError(null);
    setSqlErrors(null);
    let invalid = false;
    if (!content.trim()) {
      setContentError(text.importExport.contentEmpty);
      invalid = true;
    } else if (utf8Size(content) > MAX_SOURCE_BYTES) {
      setContentError(text.importExport.tooLarge);
      invalid = true;
    } else {
      setContentError(null);
    }
    if (!trimmed) {
      setNameError(text.importExport.nameEmpty);
      invalid = true;
    } else if (trimmed.length > MAX_NAME_LENGTH) {
      setNameError(text.importExport.nameTooLong);
      invalid = true;
    } else {
      setNameError(null);
    }
    if (invalid) return;

    setPending(true);
    try {
      // The SQL stays in the browser. Only the DBML result goes to the API (IMX-004).
      const source = formatId === "dbml" ? content : await importSql(content, formatId);
      const { diagram } = await createDiagram({ name: trimmed, source });
      onImported(diagram);
    } catch (error) {
      if (error instanceof DbmlError) setSqlErrors(error.parseErrors);
      else if (error?.fields?.name) setNameError(error.fields.name.join(" "));
      else setApiError(error);
      setPending(false);
    }
  }

  return (
    <Dialog
      title={text.importExport.importTitle}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{text.common.cancel}</Button>
          <Button type="submit" form={formId} variant="primary" disabled={pending}>
            {pending ? (
              <span className="ie-pending">
                <Spinner />
                {text.importExport.importAction}
              </span>
            ) : (
              text.importExport.importAction
            )}
          </Button>
        </>
      }
    >
      <form id={formId} className="ie-form" onSubmit={submit} noValidate>
        <Select
          label={text.importExport.formatLabel}
          options={OPTIONS}
          value={formatId}
          onChange={(event) => setFormatId(event.target.value)}
        />
        <label className="field-label" htmlFor={`${formId}-file`}>
          {text.importExport.fileLabel}
        </label>
        <input id={`${formId}-file`} type="file" accept=".dbml,.sql,.txt" onChange={onFile} />
        <TextArea
          label={text.importExport.contentLabel}
          hint={text.importExport.contentHint}
          rows={8}
          value={content}
          error={contentError}
          onChange={(event) => setContent(event.target.value)}
          spellCheck={false}
        />
        <TextField
          label={text.importExport.nameLabel}
          value={name}
          error={nameError}
          onChange={(event) => {
            nameTouched.current = true;
            setName(event.target.value);
          }}
          autoComplete="off"
        />
        {sqlErrors && (
          <Banner kind="error">
            {text.importExport.importSqlErrors}
            <ErrorList errors={sqlErrors} />
          </Banner>
        )}
        <FormError error={apiError} />
      </form>
    </Dialog>
  );
}
