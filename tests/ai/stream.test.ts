import { describe, expect, it } from "vitest";
import { extractResponseTextDelta, resolveSelectedModel } from "../../src/lib/ai/stream";

describe("OpenAI stream parser", () => {
  it("extracts text deltas from Responses API stream events", () => {
    const event = {
      type: "response.output_text.delta",
      delta: "Hello"
    };

    expect(extractResponseTextDelta(event)).toBe("Hello");
  });

  it("ignores non-text stream events", () => {
    expect(extractResponseTextDelta({ type: "response.created" })).toBe("");
  });
});

describe("model resolution", () => {
  it("prefers custom model when provided", () => {
    expect(resolveSelectedModel("gpt-5.4-mini", "custom-model")).toBe("custom-model");
  });

  it("uses preset model when custom model is empty", () => {
    expect(resolveSelectedModel("gpt-5.4-mini", " ")).toBe("gpt-5.4-mini");
  });
});
