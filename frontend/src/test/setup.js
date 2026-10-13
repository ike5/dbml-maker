import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server.js";

// The Node fetch does not accept a relative URL. A browser does, so the code
// under test uses relative URLs. This wrapper adds the origin of jsdom.
const nodeFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
  nodeFetch(
    typeof input === "string" && input.startsWith("/") ? new URL(input, location.origin) : input,
    init,
  );

// A request without a handler is a defect in the test, so it fails the test.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
