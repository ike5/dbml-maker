import { render } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { forEachDiagnostic } from "@codemirror/lint";
import { describe, expect, it } from "vitest";
import { CodePane } from "./CodePane.jsx";

// jsdom has no layout data, but CodeMirror asks for it.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator],
  });
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
}

function diagnosticsOf(view) {
  const found = [];
  forEachDiagnostic(view.state, (diagnostic, from, to) => found.push({ ...diagnostic, from, to }));
  return found;
}

describe("EDT-002 parse errors in the code pane", () => {
  it("EDT-002 shows the parse error at its line and column", () => {
    const source = "Table users {\n  id int\n  nme varchar(\n}\n";
    const errors = [{ message: "Unexpected token", line: 3, column: 3, endLine: 3, endColumn: 6 }];
    const { container } = render(
      <CodePane value={source} onChange={() => {}} errors={errors} label="Source" />,
    );
    const view = EditorView.findFromDOM(container.querySelector(".cm-editor"));

    const [diagnostic] = diagnosticsOf(view);
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.message).toBe("Unexpected token");
    expect(view.state.doc.sliceString(diagnostic.from, diagnostic.to)).toBe("nme");
    expect(view.state.doc.lineAt(diagnostic.from).number).toBe(3);
  });

  it("EDT-002 removes the diagnostic when the errors are empty", () => {
    const errors = [{ message: "Bad", line: 1, column: 1 }];
    const { container, rerender } = render(
      <CodePane value="Tabel a" onChange={() => {}} errors={errors} />,
    );
    const view = EditorView.findFromDOM(container.querySelector(".cm-editor"));
    expect(diagnosticsOf(view)).toHaveLength(1);
    rerender(<CodePane value="Table a" onChange={() => {}} errors={[]} />);
    expect(diagnosticsOf(view)).toHaveLength(0);
  });
});
