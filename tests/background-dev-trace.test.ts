import { describe, expect, it, vi } from "vitest";
import {
  createAiTrace,
  createAiPortTraceEmitter,
  createToolTrace,
  completeToolTrace,
  failToolTrace
} from "../src/core/devtools/background-trace";
import type { AiDevContext } from "../src/core/devtools/types";
import type { ProviderRuntimeConfig } from "../src/core/ai/runtime";

describe("background-trace AI Traces", () => {
  const context: AiDevContext = { surface: "sidepanel", feature: "chat" };
  const runtime: ProviderRuntimeConfig = {
    providerId: "openai",
    providerLabel: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelUrl: "https://api.openai.com/v1/models",
    apiKey: "sk-key",
    model: "gpt-4o",
    requiresApiKey: true,
    knownModels: [],
    thinkingMode: "off",
    devMode: true
  };

  it("createAiTrace filters effectiveRequestParams to allowed keys only", () => {
    const trace = createAiTrace({
      requestId: "req-1",
      context,
      runtime,
      thinkingMode: "high",
      extraBodyParams: {
        reasoning_effort: "high",
        thinking: { type: "disabled" },
        stream_options: { include_usage: true },
        unsafe_param: "secret"
      },
      now: 1000
    });

    expect(trace.effectiveRequestParams).toEqual({
      reasoning_effort: "high",
      thinking: { type: "disabled" },
      stream_options: { include_usage: true }
    });
  });

  it("createAiPortTraceEmitter sends start, reasoning, updates and succeeds on done", () => {
    const trace = createAiTrace({
      requestId: "req-1",
      context,
      runtime,
      thinkingMode: "off",
      now: 1000
    });

    const send = vi.fn();
    const nowMock = vi.fn().mockReturnValue(2000);

    const emitter = createAiPortTraceEmitter({
      trace,
      send,
      now: nowMock
    });

    // Start event sent immediately
    expect(send).toHaveBeenCalledWith({
      type: "AI_STREAM_DEBUG_START",
      requestId: "req-1",
      trace
    });

    // Send reasoning delta
    emitter.onReasoningDelta("Plan");
    expect(send).toHaveBeenCalledWith({
      type: "AI_STREAM_REASONING",
      requestId: "req-1",
      delta: "Plan"
    });

    // Send usage update
    emitter.onUsage({ inputTokens: 5, outputTokens: 10, totalTokens: 15 });
    expect(send).toHaveBeenCalledWith({
      type: "AI_STREAM_DEBUG_UPDATE",
      requestId: "req-1",
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 }
    });

    // Send finish reason update
    emitter.onFinishReason("stop");
    expect(send).toHaveBeenCalledWith({
      type: "AI_STREAM_DEBUG_UPDATE",
      requestId: "req-1",
      finishReason: "stop"
    });

    // Finish: trace gửi kèm DONE không lặp lại reasoning (UI đã nhận qua AI_STREAM_REASONING)
    const finalTrace = emitter.onDone();
    expect(finalTrace.status).toBe("success");
    expect(finalTrace.finishedAt).toBe(2000);
    expect(finalTrace.thinking).toEqual({ state: "returned", content: "" });
  });

  it("onFirstToken returns the first-token timestamp so background can send it to the UI", () => {
    const trace = createAiTrace({
      requestId: "req-1",
      context,
      runtime,
      thinkingMode: "off",
      now: 1000
    });
    const emitter = createAiPortTraceEmitter({
      trace,
      send: vi.fn(),
      now: vi.fn().mockReturnValueOnce(1250).mockReturnValue(3000)
    });

    const at = emitter.onFirstToken();
    expect(at).toBe(1250);
    expect(at).toBeGreaterThanOrEqual(trace.startedAt);

    const finalTrace = emitter.onDone();
    expect(finalTrace.firstTokenAt).toBe(1250);
  });

  it("finalizes status correctly on error/cancellation without resending reasoning", () => {
    const trace = createAiTrace({
      requestId: "req-1",
      context,
      runtime,
      thinkingMode: "off",
      now: 1000
    });

    const send = vi.fn();
    const nowMock = vi.fn().mockReturnValue(1500);

    const emitter = createAiPortTraceEmitter({
      trace,
      send,
      now: nowMock
    });

    emitter.onReasoningDelta("Partial reasoning");

    const finalTrace = emitter.onError("Cancelled by user", "cancelled");
    expect(finalTrace.status).toBe("cancelled");
    expect(finalTrace.finishedAt).toBe(1500);
    expect(finalTrace.error).toBe("Cancelled by user");
    expect(finalTrace.thinking).toEqual({ state: "returned", content: "" });
  });
});

describe("background-trace Tool Traces", () => {
  it("creates, completes and fails tool traces correctly and immutably", () => {
    const trace = createToolTrace({ requestId: "read-1", tool: "read-page", now: 10 });
    expect(trace).toEqual({
      requestId: "read-1",
      tool: "read-page",
      status: "pending",
      startedAt: 10,
      metadata: {}
    });

    const completed = completeToolTrace(trace, 20, {
      extractor: "readability",
      contentChars: 120,
      warnings: 0
    });

    expect(completed).toMatchObject({
      status: "success",
      finishedAt: 20,
      metadata: { extractor: "readability", contentChars: 120, warnings: 0 }
    });
    
    // Immutable check: original trace remains unchanged
    expect(trace.status).toBe("pending");
    expect(trace.finishedAt).toBeUndefined();

    // Does not overwrite finishedAt once complete
    const completedAgain = completeToolTrace(completed, 30, { contentChars: 200 });
    expect(completedAgain.finishedAt).toBe(20);

    const failed = failToolTrace(trace, 25, "Injection error");
    expect(failed).toMatchObject({
      status: "error",
      finishedAt: 25,
      error: "Injection error"
    });
  });
});
