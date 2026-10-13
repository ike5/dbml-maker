import { useId, useRef } from "react";
import "./ui.css";

/**
 * A tab list with keyboard arrows. The caller shows the panel for the selected tab.
 * @param {object} props
 * @param {string} props.label Accessible name of the tab list.
 * @param {{ id: string, label: string }[]} props.tabs
 * @param {string} props.value Id of the selected tab.
 * @param {(id: string) => void} props.onChange
 */
export function Tabs({ label, tabs, value, onChange }) {
  const prefix = useId();
  const refs = useRef({});

  function onKeyDown(event) {
    const index = tabs.findIndex((tab) => tab.id === value);
    let next = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(node) => {
            refs.current[tab.id] = node;
          }}
          type="button"
          role="tab"
          id={`${prefix}-tab-${tab.id}`}
          aria-selected={tab.id === value}
          tabIndex={tab.id === value ? 0 : -1}
          className="tab"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
