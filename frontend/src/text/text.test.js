import { describe, expect, it } from "vitest";
import { text } from "./en.js";
import { errorMessage } from "./errors.js";
import { format } from "./format.js";

describe("format", () => {
  it("replaces the tokens", () => {
    expect(format(text.diagrams.copyOf, { name: "Shop" })).toBe("Copy of Shop");
  });

  it("keeps a token that has no value", () => {
    expect(format("A {x} and {y}", { x: 1 })).toBe("A 1 and {y}");
  });
});

describe("errorMessage", () => {
  it("uses the text of the code first", () => {
    expect(errorMessage({ code: "throttled", message: "Server text." })).toBe(
      text.errors.byCode.throttled,
    );
  });

  it("uses the message of the server for an unknown code", () => {
    expect(errorMessage({ code: "other", message: "Server text." })).toBe("Server text.");
  });

  it("uses the general message at last", () => {
    expect(errorMessage({ code: "other", message: "" })).toBe(text.errors.general);
    expect(errorMessage(null)).toBe(text.errors.general);
  });

  it("has a text for each error code of DESIGN.md §7.11", () => {
    const codes = [
      "validation_failed",
      "invalid_if_match",
      "share_self",
      "not_authenticated",
      "reauthentication_required",
      "permission_denied",
      "diagram_forbidden",
      "not_found",
      "diagram_not_found",
      "version_not_found",
      "share_not_found",
      "public_link_not_found",
      "diagram_not_in_trash",
      "share_exists",
      "share_limit",
      "public_link_off",
      "diagram_conflict",
      "source_too_large",
      "layout_too_large",
      "precondition_required",
      "throttled",
      "network_error",
      "server_error",
    ];
    for (const code of codes) expect(text.errors.byCode[code]).toBeTruthy();
  });
});
