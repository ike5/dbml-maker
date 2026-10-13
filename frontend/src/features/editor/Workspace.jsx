// The code pane and the canvas with the split. The editor page and the public view page share it.
import { Canvas } from "./canvas/Canvas.jsx";
import { CodePane } from "./code/CodePane.jsx";
import { text } from "../../text/en.js";
import { SplitLayout } from "./SplitLayout.jsx";
import { useEditorStore } from "./store.js";

/**
 * @param {object} props
 * @param {import("react").Ref<any>} props.canvasRef
 * @param {string} props.viewportKey
 */
export function Workspace({ canvasRef, viewportKey }) {
  const source = useEditorStore((s) => s.source);
  const parseErrors = useEditorStore((s) => s.parseErrors);
  const parseResult = useEditorStore((s) => s.parseResult);
  const layout = useEditorStore((s) => s.layout);
  const readOnly = useEditorStore((s) => s.readOnly);
  const setSource = useEditorStore((s) => s.setSource);
  const setLayout = useEditorStore((s) => s.setLayout);

  return (
    <SplitLayout
      left={
        <CodePane
          value={source}
          onChange={setSource}
          errors={parseErrors}
          readOnly={readOnly}
          label={text.editorCode.defaultLabel}
        />
      }
      right={
        <Canvas
          ref={canvasRef}
          parseResult={parseResult}
          layout={layout}
          onLayoutChange={setLayout}
          readOnly={readOnly}
          viewportKey={viewportKey}
        />
      }
    />
  );
}
