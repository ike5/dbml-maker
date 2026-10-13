import { useRef, useState } from "react";
import { text } from "../../text/en.js";
import "./editor.css";

export const SPLIT_STORAGE_KEY = "dbml-maker:editor-split";
const DEFAULT_PERCENT = 40;
const MIN_PERCENT = 15;
const MAX_PERCENT = 85;
const KEY_STEP = 2;

const clamp = (value) => Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, value));

function readStored() {
  try {
    const value = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? clamp(value) : DEFAULT_PERCENT;
  } catch {
    return DEFAULT_PERCENT;
  }
}

function store(percent) {
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, String(percent));
  } catch {
    // The browser can block storage. The split then lasts only for this page.
  }
}

/**
 * The code pane on the left, the canvas on the right, and a divider between them.
 * The user moves the divider with the pointer or with the arrow keys.
 * @param {object} props
 * @param {import("react").ReactNode} props.left
 * @param {import("react").ReactNode} props.right
 */
export function SplitLayout({ left, right }) {
  const [percent, setPercent] = useState(readStored);
  const containerRef = useRef(null);

  const change = (value) => {
    const next = clamp(value);
    setPercent(next);
    store(next);
  };

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
    const box = containerRef.current.getBoundingClientRect();
    if (box.width > 0) change(((event.clientX - box.left) / box.width) * 100);
  };
  const onKeyDown = (event) => {
    if (event.key === "ArrowLeft") change(percent - KEY_STEP);
    else if (event.key === "ArrowRight") change(percent + KEY_STEP);
    else return;
    event.preventDefault();
  };

  return (
    <div className="editor-split" ref={containerRef}>
      <div className="editor-pane" style={{ width: `${percent}%` }}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={text.editor.splitLabel}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={MIN_PERCENT}
        aria-valuemax={MAX_PERCENT}
        tabIndex={0}
        className="editor-divider"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
      />
      <div className="editor-pane editor-pane-grow">{right}</div>
    </div>
  );
}
