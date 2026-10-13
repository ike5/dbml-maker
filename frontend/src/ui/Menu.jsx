import { useEffect, useId, useRef, useState } from "react";
import { text } from "../text/en.js";
import { MoreIcon } from "./icons.jsx";
import { IconButton } from "./Button.jsx";
import "./ui.css";

/**
 * A button that opens a list of actions.
 * @param {object} props
 * @param {string} [props.label] Accessible name of the button.
 * @param {{ label: string, onSelect: () => void, danger?: boolean, disabled?: boolean }[]} props.items
 * @param {import("react").ReactNode} [props.icon]
 */
export function Menu({ label = text.common.more, items, icon = <MoreIcon /> }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const enabled = rootRef.current.querySelectorAll('[role="menuitem"]:not([disabled])');
    enabled[0]?.focus();
    function onPointerDown(event) {
      if (!rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(event) {
    if (!open) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const enabled = [...rootRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const index = enabled.indexOf(document.activeElement);
    let next = null;
    if (event.key === "ArrowDown") next = (index + 1) % enabled.length;
    else if (event.key === "ArrowUp") next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    if (next === null) return;
    event.preventDefault();
    enabled[next]?.focus();
  }

  return (
    <div className="menu" ref={rootRef} onKeyDown={onKeyDown}>
      <IconButton
        ref={buttonRef}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
      </IconButton>
      {open && (
        <ul className="menu-list" role="menu" id={menuId} aria-label={label}>
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                className={item.danger ? "menu-item menu-item-danger" : "menu-item"}
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
