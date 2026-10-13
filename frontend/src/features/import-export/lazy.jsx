import { lazy, Suspense } from "react";
import { Spinner } from "../../ui/index.js";

// The dialogs load their code at the first use, so the main bundle stays small (DESIGN.md §13.3).
const LazyExportDialog = lazy(() =>
  import("./ExportDialog.jsx").then((module) => ({ default: module.ExportDialog })),
);
const LazyImportDialog = lazy(() =>
  import("./ImportDialog.jsx").then((module) => ({ default: module.ImportDialog })),
);

/** @param {import("./ExportDialog.jsx").ExportDialogProps} props */
export function ExportDialog(props) {
  return (
    <Suspense fallback={<Spinner />}>
      <LazyExportDialog {...props} />
    </Suspense>
  );
}

/** @param {import("./ImportDialog.jsx").ImportDialogProps} props */
export function ImportDialog(props) {
  return (
    <Suspense fallback={<Spinner />}>
      <LazyImportDialog {...props} />
    </Suspense>
  );
}
