import { describe, expect, it } from "vitest";
import type { AiDevTrace } from "../../src/core/devtools/types";
import {
  appendReasoning,
  markFirstToken,
  applyDebugUpdate,
  finishAiTrace,
  failAiTrace
} from "../../src/core/devtools/trace-reducer";

describe("trace-reducer", () => {
  const baseTrace: AiDevTrace = {
    requestId: "req-1",
    surface: "sidepanel",
    feature: "chat",
    status: "pending",
    providerId: "openai",
    model: "gpt-4o",
    requestedThinkingMode: "high",
    effectiveRequestParams: {},
    startedAt: 1000,
    thinking: { state: "pending", content: "" }
  };

  it("appends reasoning correctly and immutably", () => {
    const t1 = appendReasoning(baseTrace, "Plan");
    const t2 = appendReasoning(t1, " two");

    expect(t1.thinking).toEqual({ state: "returned", content: "Plan" });
    expect(t2.thinking).toEqual({ state: "returned", content: "Plan two" });
    expect(baseTrace.thinking.content).toBe(""); // unchanged
  });

  it("marks first token immutably", () => {
    const t1 = markFirstToken(baseTrace, 1200);
    expect(t1.firstTokenAt).toBe(1200);
    expect(baseTrace.firstTokenAt).toBeUndefined(); // unchanged
  });

  it("applies debug updates (usage, finishReason) immutably", () => {
    const t1 = applyDebugUpdate(baseTrace, {
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      finishReason: "stop"
    });
    expect(t1.usage).toEqual({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(t1.finishReason).toBe("stop");
    expect(baseTrace.usage).toBeUndefined();
    expect(baseTrace.finishReason).toBeUndefined();
  });

  it("finishes trace immutably (success)", () => {
    const withReasoning = appendReasoning(baseTrace, "Plan");
    const t1 = finishAiTrace(withReasoning, 2000);

    expect(t1.status).toBe("success");
    expect(t1.finishedAt).toBe(2000);
    expect(t1.thinking.state).toBe("returned");

    const t2 = finishAiTrace(baseTrace, 2000);
    expect(t2.thinking.state).toBe("not-returned");
  });

  it("fails trace immutably", () => {
    const t1 = failAiTrace(baseTrace, "Failed to fetch", 2000);
    expect(t1.status).toBe("error");
    expect(t1.error).toBe("Failed to fetch");
    expect(t1.finishedAt).toBe(2000);
    expect(baseTrace.status).toBe("pending");
  });
});
