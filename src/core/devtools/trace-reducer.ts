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

// Ghép trace đã chốt từ background vào trace đang hiển thị.
// Background không gửi lại reasoning trong DONE/ERROR (UI đã nhận qua AI_STREAM_REASONING),
// nên giữ phần reasoning UI đang có nếu trace cuối không kèm nội dung.
export function mergeFinalTrace(current: AiDevTrace | undefined, final: AiDevTrace): AiDevTrace {
  const content = final.thinking.content || current?.thinking.content || "";
  return {
    ...final,
    thinking: content ? { state: "returned", content } : final.thinking
  };
}

// Cách một lượt stream kết thúc: trace background đã chốt, hoặc UI tự chốt
export type AiTraceEnding =
  | { trace: AiDevTrace }
  | { status: "success"; now: number }
  | { error: string; status: "error" | "cancelled" | "interrupted"; now: number };

// Chốt trace khi stream kết thúc; trace đã chốt rồi thì giữ nguyên
export function endAiTrace(
  current: AiDevTrace | undefined,
  ending: AiTraceEnding
): AiDevTrace | undefined {
  if ("trace" in ending) return mergeFinalTrace(current, ending.trace);
  if (!current || current.status !== "pending") return current;
  if (ending.status === "success") return finishAiTrace(current, ending.now);
  return failAiTrace(current, ending.error, ending.now, ending.status);
}
