import { describe, expect, it } from "vitest";
import { readStreamDebugEvent } from "../../src/lib/devtools/stream";

describe("readStreamDebugEvent", () => {
  it("extracts reasoning content, finish reason, and usage from a standard chunk", () => {
    const chunk = {
      choices: [
        {
          delta: { reasoning_content: "Plan first" },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: 12,
        completion_tokens: 7,
        total_tokens: 19
      }
    };
    expect(readStreamDebugEvent(chunk)).toEqual({
      reasoningDelta: "Plan first",
      finishReason: "stop",
      usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 }
    });
  });

  it("extracts reasoning when reasoning_content is absent", () => {
    const chunk = {
      choices: [
        {
          delta: { reasoning: "Alternate plan" }
        }
      ]
    };
    expect(readStreamDebugEvent(chunk)).toEqual({
      reasoningDelta: "Alternate plan"
    });
  });

  it("ignores non-integer, negative, array, or object values in token usage", () => {
    const chunk = {
      usage: {
        prompt_tokens: -5,
        completion_tokens: "large" as any,
        total_tokens: { count: 10 } as any
      }
    };
    expect(readStreamDebugEvent(chunk)).toEqual({});
  });

  it("ignores non-string or empty finish reasons", () => {
    const chunk1 = { choices: [{ finish_reason: 123 as any }] };
    const chunk2 = { choices: [{ finish_reason: "" }] };
    const chunk3 = { choices: [{ finish_reason: [] as any }] };
    expect(readStreamDebugEvent(chunk1)).toEqual({});
    expect(readStreamDebugEvent(chunk2)).toEqual({});
    expect(readStreamDebugEvent(chunk3)).toEqual({});
  });

  it("handles content-only chunks without throwing", () => {
    const chunk = {
      choices: [
        {
          delta: { content: "normal text" }
        }
      ]
    };
    expect(readStreamDebugEvent(chunk)).toEqual({});
  });
});
