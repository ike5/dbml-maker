import { text } from "../../text/en.js";

const UNITS = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/**
 * Show a time as text such as "5 minutes ago".
 * @param {string} iso
 * @param {number} [now] Time in milliseconds. A test can give a fixed value.
 */
export function relativeTime(iso, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return text.diagrams.justNow;
}

/** @param {string} iso */
export function dateText(iso) {
  return new Date(iso).toLocaleDateString("en", { dateStyle: "medium" });
}

/** @param {{ display_name?: string, email: string } | null} user */
export function personName(user) {
  return user ? user.display_name || user.email : "";
}
