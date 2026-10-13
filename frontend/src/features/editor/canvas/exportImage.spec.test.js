import { beforeEach, describe, expect, it, vi } from "vitest";

const toBlob = vi.fn();
const toSvg = vi.fn();
vi.mock("html-to-image", () => ({ toBlob: (...a) => toBlob(...a), toSvg: (...a) => toSvg(...a) }));

const { exportImage, decodeDataUrl } = await import("./export-image.js");

const nodes = [
  { id: "a", position: { x: 0, y: 0 }, measured: { width: 100, height: 50 } },
  { id: "b", position: { x: 300, y: 200 }, measured: { width: 100, height: 50 } },
];

describe("exportImage", () => {
  beforeEach(() => {
    toBlob.mockReset();
    toSvg.mockReset();
  });

  it("IMX-002 exports the canvas as PNG and SVG", async () => {
    const element = document.createElement("div");
    toBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    const svg = "<svg><text>a &amp; b é</text></svg>";
    toSvg.mockResolvedValue(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

    const png = await exportImage({ viewportElement: element, nodes, format: "png" });
    expect(png.type).toBe("image/png");
    const [target, options] = toBlob.mock.calls[0];
    expect(target).toBe(element);
    expect(options).toMatchObject({ backgroundColor: "#ffffff", skipFonts: true });
    // The image covers the full diagram (400 x 250) and the padding.
    expect(options.width).toBe(480);
    expect(options.height).toBe(330);

    const image = await exportImage({ viewportElement: element, nodes, format: "svg" });
    expect(image.type).toBe("image/svg+xml");
    expect(await image.text()).toBe(svg);
  });

  it("rejects an unknown format", async () => {
    await expect(
      exportImage({ viewportElement: document.createElement("div"), nodes, format: "gif" }),
    ).rejects.toThrow();
  });

  it("rejects when html-to-image gives no PNG", async () => {
    toBlob.mockResolvedValue(null);
    await expect(
      exportImage({ viewportElement: document.createElement("div"), nodes, format: "png" }),
    ).rejects.toThrow();
  });

  it("decodes a base64 data URL as UTF-8", () => {
    const base64 = btoa(String.fromCharCode(...new TextEncoder().encode("é<a>")));
    expect(decodeDataUrl(`data:image/svg+xml;base64,${base64}`)).toBe("é<a>");
  });
});
