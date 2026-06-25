import { describe, expect, it } from "vitest";
import { mapStreamError } from "../../src/lib/ai/stream";

describe("mapStreamError", () => {
  it("returns empty string for AbortError", () => {
    const error = new DOMException("aborted", "AbortError");
    expect(mapStreamError(error)).toBe("");
  });

  it("returns network message for TypeError", () => {
    expect(mapStreamError(new TypeError("fetch failed"))).toBe("Network error. Check your internet connection.");
  });

  it("returns the error message for regular errors", () => {
    expect(mapStreamError(new Error("Invalid API key"))).toBe("Invalid API key");
  });
});
