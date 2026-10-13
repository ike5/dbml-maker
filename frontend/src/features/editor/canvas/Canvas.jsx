import "@xyflow/react/dist/style.css";
import "./canvas.css";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { text } from "../../../text/en.js";
import { GroupNode } from "./GroupNode.jsx";
import { RefEdge } from "./RefEdge.jsx";
import { TableNode } from "./TableNode.jsx";
import { exportImage } from "./export-image.js";
import { getElk } from "./layout/elk.js";
import { arrangeAll, placeMissing } from "./layout/layout.js";
import { estimateSize } from "./layout/size.js";
import {
  GROUP_NODE_TYPE,
  REF_EDGE_TYPE,
  TABLE_NODE_TYPE,
  toLayout,
  toNodesAndEdges,
} from "./toFlow.js";
import { VIEWPORT_WRITE_INTERVAL_MS, readViewport, writeViewport } from "./viewport.js";

const t = text.editorCanvas;

// Defined outside the component, so that React Flow gets the same objects at each render.
const NODE_TYPES = { [TABLE_NODE_TYPE]: TableNode, [GROUP_NODE_TYPE]: GroupNode };
const EDGE_TYPES = { [REF_EDGE_TYPE]: RefEdge };
const ARIA_LABELS = {
  "controls.ariaLabel": t.controlsLabel,
  "controls.zoomIn.ariaLabel": t.zoomIn,
  "controls.zoomOut.ariaLabel": t.zoomOut,
  "controls.fitView.ariaLabel": t.fitView,
};
const FIT_OPTIONS = { padding: 0.2, maxZoom: 1 };
// DESIGN.md §12.7: above this number of tables, the canvas renders only the visible elements.
const VIRTUALIZE_ABOVE = 200;
const NO_TABLES = {};

/**
 * The canvas of the editor (DESIGN.md §12.7, §12.10).
 *
 * The parent must give the component a parent element with a height, because React Flow fills it.
 * `onLayoutChange(layout)` gets the full layout after a drag stop, after the automatic position of
 * new tables (EDT-004), and after `arrange()`. The ref gives `arrange()`, `fitView()`, and
 * `exportImage(format)`.
 */
export function Canvas({ parseResult, layout, onLayoutChange, readOnly, viewportKey, ref }) {
  return (
    <ReactFlowProvider>
      <CanvasInner
        parseResult={parseResult}
        layout={layout}
        onLayoutChange={onLayoutChange}
        readOnly={readOnly}
        viewportKey={viewportKey}
        ref={ref}
      />
    </ReactFlowProvider>
  );
}

function CanvasInner({ parseResult, layout, onLayoutChange, readOnly, viewportKey, ref }) {
  const flow = useReactFlow();
  const containerRef = useRef(null);
  const layoutTables = layout?.tables ?? NO_TABLES;

  // Positions that the user or "arrange" set, and positions that elk gave. The layout from the
  // parent wins over the elk positions. A new layout from the parent replaces the user positions,
  // because the parent has then saved them.
  const [overrides, setOverrides] = useState(NO_TABLES);
  const [auto, setAuto] = useState(NO_TABLES);
  const [seenLayout, setSeenLayout] = useState(layout);
  if (layout !== seenLayout) {
    setSeenLayout(layout);
    setOverrides(NO_TABLES);
  }
  // Sizes that React Flow measured. React Flow needs them back in the nodes (see toFlow.js).
  const [sizes, setSizes] = useState(NO_TABLES);

  const positions = useMemo(() => {
    const result = {};
    for (const table of parseResult?.tables ?? []) {
      const position = overrides[table.key] ?? layoutTables[table.key] ?? auto[table.key];
      if (position) result[table.key] = position;
    }
    return result;
  }, [parseResult, overrides, layoutTables, auto]);

  const { nodes, edges } = useMemo(
    () => (parseResult ? toNodesAndEdges(parseResult, positions, sizes) : { nodes: [], edges: [] }),
    [parseResult, positions, sizes],
  );

  // The callback can change at each render. A ref keeps the effects below from restart.
  const onLayoutChangeRef = useRef(onLayoutChange);
  useEffect(() => {
    onLayoutChangeRef.current = onLayoutChange;
  });

  // EDT-004: give a position to each table without one. The other tables do not move.
  useEffect(() => {
    if (!parseResult || parseResult.tables.every((table) => positions[table.key])) return;
    let cancelled = false;
    placeMissing({ parseResult, positions, elk: getElk() }).then((placed) => {
      if (cancelled) return;
      setAuto((current) => ({ ...current, ...placed }));
      onLayoutChangeRef.current?.(toLayout(parseResult, { ...positions, ...placed }));
    });
    return () => {
      cancelled = true;
    };
  }, [parseResult, positions]);

  // Fit the view at the first load, and after "arrange", when all tables have a size.
  const [saved] = useState(() => readViewport(viewportKey));
  const fitPending = useRef(!saved);
  useEffect(() => {
    if (!fitPending.current || !parseResult) return;
    const keys = Object.keys(positions);
    if (keys.length === 0 || !keys.every((key) => sizes[key])) return;
    fitPending.current = false;
    flow.fitView(FIT_OPTIONS);
  }, [parseResult, positions, sizes, flow]);

  const onNodesChange = useCallback((changes) => {
    const moved = {};
    const measured = {};
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        moved[change.id] = change.position;
      } else if (
        change.type === "dimensions" &&
        change.dimensions &&
        !change.id.startsWith("group:")
      ) {
        measured[change.id] = change.dimensions;
      }
    }
    if (Object.keys(moved).length > 0) setOverrides((current) => ({ ...current, ...moved }));
    if (Object.keys(measured).length > 0) {
      setSizes((current) => {
        const changed = Object.entries(measured).filter(([id, size]) => {
          const old = current[id];
          return !old || old.width !== size.width || old.height !== size.height;
        });
        if (changed.length === 0) return current;
        return { ...current, ...Object.fromEntries(changed) };
      });
    }
  }, []);

  const onNodeDragStop = useCallback(
    (_event, _node, dragged) => {
      const next = { ...positions };
      for (const node of dragged) next[node.id] = node.position;
      setOverrides((current) => ({ ...current, ...next }));
      onLayoutChange?.(toLayout(parseResult, next));
    },
    [positions, parseResult, onLayoutChange],
  );

  // Write the viewport at most one time in each interval. The last viewport wins.
  const viewportTimer = useRef(null);
  const lastViewport = useRef(null);
  const onMove = useCallback(
    (_event, viewport) => {
      if (typeof viewportKey !== "string") return;
      lastViewport.current = viewport;
      if (viewportTimer.current !== null) return;
      viewportTimer.current = setTimeout(() => {
        viewportTimer.current = null;
        writeViewport(viewportKey, lastViewport.current);
      }, VIEWPORT_WRITE_INTERVAL_MS);
    },
    [viewportKey],
  );
  useEffect(
    () => () => {
      if (viewportTimer.current !== null) clearTimeout(viewportTimer.current);
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      async arrange() {
        if (!parseResult) return;
        const arranged = await arrangeAll({ parseResult, sizes, elk: getElk() });
        setOverrides(arranged);
        fitPending.current = true;
        onLayoutChange?.(toLayout(parseResult, arranged));
      },
      fitView() {
        flow.fitView(FIT_OPTIONS);
      },
      exportImage(format) {
        const viewportElement = containerRef.current?.querySelector(".react-flow__viewport");
        // React Flow needs a size in each node. Use the estimate for a node without a measured size.
        const sized = nodes.map((node) =>
          node.type === TABLE_NODE_TYPE && !node.measured
            ? { ...node, measured: estimateSize(node.data.table) }
            : node,
        );
        return exportImage({ viewportElement, nodes: sized, format });
      },
    }),
    [parseResult, sizes, nodes, flow, onLayoutChange],
  );

  return (
    <div className="canvas" ref={containerRef} role="region" aria-label={t.canvasLabel}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onMove={onMove}
        defaultViewport={saved ?? undefined}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        connectionMode={ConnectionMode.Loose}
        onlyRenderVisibleElements={(parseResult?.tables.length ?? 0) > VIRTUALIZE_ABOVE}
        minZoom={0.1}
        maxZoom={2}
        ariaLabelConfig={ARIA_LABELS}
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls showInteractive={false} fitViewOptions={FIT_OPTIONS} />
      </ReactFlow>
    </div>
  );
}
