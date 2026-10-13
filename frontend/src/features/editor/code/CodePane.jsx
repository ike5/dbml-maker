import { useEffect, useRef } from "react";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { lintGutter, setDiagnostics } from "@codemirror/lint";
import { dbml } from "./dbml-language.js";
import { toDiagnostics } from "./lint.js";

// Marks a change that comes from the `value` prop, so it never calls onChange.
const External = Annotation.define();

// The colors and fonts come from the variables in styles/global.css.
const theme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    fontSize: "var(--font-size)",
  },
  "&.cm-focused": { outline: "2px solid var(--focus)", outlineOffset: "-2px" },
  ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-content": { caretColor: "var(--accent)" },
  ".cm-gutters": {
    backgroundColor: "var(--bg)",
    color: "var(--text-muted)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine": { backgroundColor: "var(--surface-hover)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--surface-hover)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--danger)",
  },
  ".cm-diagnostic-error": { borderLeftColor: "var(--danger)" },
});

function readOnlyExtension(readOnly) {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];
}

function labelExtension(label) {
  return EditorView.contentAttributes.of({ "aria-label": label });
}

/**
 * The DBML code editor (DESIGN.md §12.10).
 *
 * A keyboard user can leave the editor: press Escape, then Tab. This is the
 * CodeMirror rule for `indentWithTab`, which keeps Tab for the indent (§12.9).
 * There is no close-brackets extension, because the package
 * `@codemirror/autocomplete` is not installed.
 *
 * @param {object} props
 * @param {string} props.value The source. A change from outside replaces the document and never calls onChange.
 * @param {(text: string) => void} props.onChange Called with the full text at each change by the user.
 * @param {Array} props.errors Parse errors in the ParseError shape (§13.2).
 * @param {boolean} [props.readOnly] If true, the user cannot change the text.
 * @param {string} [props.label] The accessible name. The page gives it (text.editorCode.defaultLabel).
 */
export function CodePane({ value, onChange, errors, readOnly = false, label }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const readOnlyCompartment = useRef(new Compartment());
  const labelCompartment = useRef(new Compartment());

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // One view for the life of the component.
  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          dbml(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          lintGutter(),
          theme,
          readOnlyCompartment.current.of(readOnlyExtension(readOnly)),
          labelCompartment.current.of(labelExtension(label)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            if (update.transactions.some((tr) => tr.annotation(External))) return;
            onChangeRef.current?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The view is made one time. The effects below send the later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === view.state.doc.toString()) return;
    // Keep the cursor near its old place, inside the new document.
    const { anchor, head } = view.state.selection.main;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: { anchor: Math.min(anchor, value.length), head: Math.min(head, value.length) },
      annotations: External.of(true),
    });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyCompartment.current.reconfigure(readOnlyExtension(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: labelCompartment.current.reconfigure(labelExtension(label)),
    });
  }, [label]);

  // This effect is after the value effect, so the positions use the current document.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, toDiagnostics(view.state.doc, errors)));
  }, [errors, value]);

  return <div ref={hostRef} style={{ height: "100%", minHeight: 0 }} />;
}
