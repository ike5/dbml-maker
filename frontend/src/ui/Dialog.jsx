import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { text } from "../text/en.js";
import { CloseIcon } from "./icons.jsx";
import { IconButton } from "./Button.jsx";
import "./ui.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog (DESIGN.md §12.9). The focus stays inside until the dialog
 * closes. Then the focus goes back to the element that opened the dialog.
 * @param {object} props
 * @param {string} props.title
 * @param {() => void} props.onClose
 * @param {import("react").ReactNode} [props.footer] Action buttons.
 * @param {import("react").RefObject<HTMLElement>} [props.initialFocusRef] Element for the first focus.
 */
export function Dialog({ title, onClose, footer, initialFocusRef, children }) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const panel = panelRef.current;
    // The first focus goes to the content, not to the close button in the header.
    const first =
      initialFocusRef?.current ??
      panel.querySelector(`.dialog-body :is(${FOCUSABLE})`) ??
      panel.querySelector(`.dialog-footer :is(${FOCUSABLE})`) ??
      panel.querySelector(FOCUSABLE) ??
      panel;
    first.focus();
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [initialFocusRef]);

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const firstItem = items[0];
    const lastItem = items[items.length - 1];
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  }

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="dialog-header">
          <h2 id={titleId} className="dialog-title">
            {title}
          </h2>
          <IconButton label={text.common.close} size="sm" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
