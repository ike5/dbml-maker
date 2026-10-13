import { render, screen } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
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

export function viewOf(container) {
  return EditorView.findFromDOM(container.querySelector(".cm-editor"));
}

function renderPane(props = {}) {
  const onChange = vi.fn();
  const utils = render(
    <CodePane value="Table a {}" onChange={onChange} errors={[]} label="Source" {...props} />,
  );
  return { onChange, view: viewOf(utils.container), ...utils };
}

describe("CodePane", () => {
  it("shows the first value", () => {
    const { view } = renderPane();
    expect(view.state.doc.toString()).toBe("Table a {}");
  });

  it("calls onChange with the full text after a change by the user", () => {
    const { view, onChange } = renderPane();
    view.dispatch({ changes: { from: 0, insert: "x" }, userEvent: "input.type" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("xTable a {}");
  });

  it("replaces the document for an outside value change without onChange", () => {
    const { view, onChange, rerender } = renderPane();
    view.dispatch({ selection: { anchor: 10 } });
    rerender(<CodePane value="Ref" onChange={onChange} errors={[]} label="Source" />);
    expect(view.state.doc.toString()).toBe("Ref");
    expect(view.state.selection.main.head).toBe(3);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not replace the document if the value equals the document", () => {
    const { view, onChange, rerender } = renderPane();
    const before = view.state.doc;
    rerender(<CodePane value="Table a {}" onChange={onChange} errors={[]} label="Source" />);
    expect(view.state.doc).toBe(before);
  });

  it("changes the read only mode at run time", () => {
    const { view, onChange, rerender } = renderPane({ readOnly: true });
    expect(view.state.readOnly).toBe(true);
    expect(view.contentDOM.getAttribute("contenteditable")).toBe("false");
    rerender(
      <CodePane
        value="Table a {}"
        onChange={onChange}
        errors={[]}
        readOnly={false}
        label="Source"
      />,
    );
    expect(view.state.readOnly).toBe(false);
    expect(view.contentDOM.getAttribute("contenteditable")).toBe("true");
  });

  it("gives the label to the content element", () => {
    renderPane({ label: "DBML source" });
    expect(screen.getByLabelText("DBML source")).toHaveClass("cm-content");
  });

  it("destroys the view when the component unmounts", () => {
    const { container, unmount } = renderPane();
    unmount();
    expect(container.querySelector(".cm-editor")).toBeNull();
  });
});
