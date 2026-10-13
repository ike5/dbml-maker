const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** True only for a CSS hex color (#rgb or #rrggbb). Other text never goes into a style (EDT-005). */
export function isHexColor(value) {
  return typeof value === "string" && HEX_COLOR.test(value);
}

function channels(hex) {
  const digits = hex.slice(1);
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
}

/** Give a text color with good contrast on the background color. */
export function contrastText(hex) {
  const [r, g, b] = channels(hex);
  // The brightness formula of the W3C.
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#1c2230" : "#ffffff";
}
