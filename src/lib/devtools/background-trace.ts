import type { AiDevContext, AiDevTrace, TokenUsage, ToolDevTrace } from "./types";
import type { ProviderRuntimeConfig } from "../ai/runtime";
import type { Settings } from "../storage/types";
import type { AiPortResponse } from "../messaging/types";
import {
  appendReasoning,
  markFirstToken,
  applyDebugUpdate,
  finishAiTrace,
  failAiTrace
} from "./trace-reducer";

function pickSafeRequestParams(extraBodyParams?: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!extraBodyParams) return result;
  
  if ("reasoning_effort" in extraBodyParams) {
    result.reasoning_effort = extraBodyParams.reasoning_effort;
  }
  if ("stream_options" in extraBodyParams) {
    result.stream_options = extraBodyParams.stream_options;
  }
  return result;
}

export function createAiTrace(input: {
  requestId: string;
  context: AiDevContext;
  runtime: ProviderRuntimeConfig;
  thinkingMode: Settings["thinkingMode"];
  extraBodyParams?: Record<string, unknown>;
  now: number;
}): AiDevTrace {
  return {
    requestId: input.requestId,
    surface: input.context.surface,
    feature: input.context.feature,
    status: "pending",
    providerId: input.runtime.providerId,
    model: input.runtime.model,
    requestedThinkingMode: input.thinkingMode,
    effectiveRequestParams: pickSafeRequestParams(input.extraBodyParams),
    startedAt: input.now,
    thinking: { state: "pending", content: "" }
  };
}

export function createAiPortTraceEmitter(input: {
  trace: AiDevTrace;
  send: (message: AiPortResponse) => void;
  now: () => number;
}) {
  let trace = { ...input.trace };

  // Send the start event immediately
  input.send({
    type: "AI_STREAM_DEBUG_START",
    requestId: trace.requestId,
    trace
  });

  return {
    onReasoningDelta: (delta: string) => {
      trace = appendReasoning(trace, delta);
      input.send({
        type: "AI_STREAM_REASONING",
        requestId: trace.requestId,
        delta
      });
    },
    onFirstToken: () => {
      trace = markFirstToken(trace, input.now());
    },
    onUsage: (usage: TokenUsage) => {
      trace = applyDebugUpdate(trace, { usage });
      input.send({
        type: "AI_STREAM_DEBUG_UPDATE",
        requestId: trace.requestId,
        usage
      });
    },
    onFinishReason: (finishReason: string) => {
      trace = applyDebugUpdate(trace, { finishReason });
      input.send({
        type: "AI_STREAM_DEBUG_UPDATE",
        requestId: trace.requestId,
        finishReason
      });
    },
    onDone: (): AiDevTrace => {
      trace = finishAiTrace(trace, input.now());
      return trace;
    },
    onError: (message: string, status: "error" | "cancelled" | "interrupted" = "error"): AiDevTrace => {
      trace = failAiTrace(trace, message, input.now(), status);
      return trace;
    }
  };
}

export function createToolTrace(input: {
  requestId: string;
  tool: "read-page" | "selection-action" | "open-reader";
  now: number;
}): ToolDevTrace {
  return {
    requestId: input.requestId,
    tool: input.tool,
    status: "pending",
    startedAt: input.now,
    metadata: {}
  };
}

export function completeToolTrace(
  trace: ToolDevTrace,
  now: number,
  metadata: Record<string, string | number | boolean>
): ToolDevTrace {
  if (trace.finishedAt !== undefined) return trace;
  return {
    ...trace,
    status: "success",
    finishedAt: now,
    metadata: { ...trace.metadata, ...metadata }
  };
}

export function failToolTrace(
  trace: ToolDevTrace,
  now: number,
  error: string
): ToolDevTrace {
  if (trace.finishedAt !== undefined) return trace;
  return {
    ...trace,
    status: "error",
    finishedAt: now,
    error
  };
}
