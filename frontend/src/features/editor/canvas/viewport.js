// The pan and the zoom are per user, not per diagram content. They stay in localStorage (DESIGN.md §7.2).
export const VIEWPORT_WRITE_INTERVAL_MS = 500;

/** Read a saved viewport. Return null if the key is not a string, or if the data is not usable. */
export function readViewport(key) {
  if (typeof key !== "string") return null;
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (value && [value.x, value.y, value.zoom].every(Number.isFinite) && value.zoom > 0) {
      return { x: value.x, y: value.y, zoom: value.zoom };
    }
  } catch {
    // localStorage can be blocked, and the data can be damaged. The canvas then fits the view.
  }
  return null;
}

export function writeViewport(key, viewport) {
  try {
    localStorage.setItem(key, JSON.stringify(viewport));
  } catch {
    // A full or blocked localStorage only loses the saved view.
  }
}
