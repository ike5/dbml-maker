import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
import { toBlob, toSvg } from "html-to-image";

const IMAGE_PADDING = 40;
const PNG_PIXEL_RATIO = 2;

/** Decode a data URL to a string, without fetch (only src/lib/api/ calls fetch). */
export function decodeDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (!header.endsWith(";base64")) return decodeURIComponent(body);
  const bytes = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Make an image of the full diagram (IMX-002, DESIGN.md §13.3).
 *
 * html-to-image serializes the DOM with XMLSerializer, which escapes all text. For this reason,
 * the text of a diagram cannot add markup to the image (EDT-005, DESIGN.md §4.7).
 * The app uses system fonts, and the CSP blocks other sources, so the export skips web fonts.
 *
 * @param {{ viewportElement: HTMLElement, nodes: object[], format: "png" | "svg" }} args
 *   viewportElement: the element `.react-flow__viewport`.
 *   nodes: the nodes with a size, in `measured`, `width`, or `height`.
 * @returns {Promise<Blob>}
 */
export async function exportImage({ viewportElement, nodes, format }) {
  if (format !== "png" && format !== "svg") {
    throw new Error(`Unknown image format: ${format}`);
  }
  const bounds = getNodesBounds(nodes);
  const width = Math.max(1, Math.ceil(bounds.width + 2 * IMAGE_PADDING));
  const height = Math.max(1, Math.ceil(bounds.height + 2 * IMAGE_PADDING));
  // The image size already includes the padding. The zoom limits 1 and 1 keep the true size.
  const viewport = getViewportForBounds(bounds, width, height, 1, 1, 0);
  const options = {
    backgroundColor: "#ffffff",
    width,
    height,
    skipFonts: true,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  };

  if (format === "png") {
    const blob = await toBlob(viewportElement, { ...options, pixelRatio: PNG_PIXEL_RATIO });
    if (!blob) throw new Error("The canvas cannot make the PNG image.");
    return blob;
  }
  const dataUrl = await toSvg(viewportElement, options);
  return new Blob([decodeDataUrl(dataUrl)], { type: "image/svg+xml" });
}
