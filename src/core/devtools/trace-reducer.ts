import type { AiDevTrace, TokenUsage } from "./types";

export function appendReasoning(trace: AiDevTrace, delta: string): AiDevTrace {
  return {
    ...trace,
    thinking: {
      state: "returned",
      content: trace.thinking.content + delta
    }
  };
}

export function markFirstToken(trace: AiDevTrace, now: number): AiDevTrace {
  return {
    ...trace,
    firstTokenAt: now
  };
}

export function applyDebugUpdate(
  trace: AiDevTrace,
  update: { usage?: TokenUsage; finishReason?: string }
): AiDevTrace {
  return {
    ...trace,
    ...(update.usage ? { usage: update.usage } : {}),
    ...(update.finishReason ? { finishReason: update.finishReason } : {})
  };
}

export function finishAiTrace(trace: AiDevTrace, now: number): AiDevTrace {
  return {
    ...trace,
    status: "success",
    finishedAt: now,
    thinking: trace.thinking.content
      ? trace.thinking
      : { state: "not-returned", content: "" }
  };
}

export function failAiTrace(
  trace: AiDevTrace,
  error: string,
  now: number,
  status: "error" | "cancelled" | "interrupted" = "error"
): AiDevTrace {
  return {
    ...trace,
    status,
    finishedAt: now,
    error,
    thinking: trace.thinking.content
      ? trace.thinking
      : { state: "not-returned", content: "" }
  };
}
