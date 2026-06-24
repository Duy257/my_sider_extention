import { describe, expect, it } from "vitest";
import { resolveSelectedModel, mapStreamError } from "../../src/lib/ai/stream";

describe("model resolution", () => {
  it("prefers custom model when provided", () => {
    expect(resolveSelectedModel("gpt-5.4-mini", "custom-model")).toBe("custom-model");
  });

  it("uses preset model when custom model is empty", () => {
    expect(resolveSelectedModel("gpt-5.4-mini", " ")).toBe("gpt-5.4-mini");
  });

  it("falls back to default when nothing is provided", () => {
    expect(resolveSelectedModel()).toBe("gpt-5.4-mini");
  });
});

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
