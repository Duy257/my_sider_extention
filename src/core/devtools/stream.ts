import type { TokenUsage } from "./types";

export type StreamDebugEvent = {
  reasoningDelta?: string;
  usage?: TokenUsage;
  finishReason?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readTokenUsage(usageVal: unknown): TokenUsage | undefined {
  const usageRecord = asRecord(usageVal);
  const input = usageRecord.prompt_tokens;
  const output = usageRecord.completion_tokens;
  const total = usageRecord.total_tokens;

  const isValidNumber = (val: unknown): val is number =>
    typeof val === "number" && Number.isInteger(val) && val >= 0;

  const result: TokenUsage = {};
  let hasValid = false;

  if (isValidNumber(input)) {
    result.inputTokens = input;
    hasValid = true;
  }
  if (isValidNumber(output)) {
    result.outputTokens = output;
    hasValid = true;
  }
  if (isValidNumber(total)) {
    result.totalTokens = total;
    hasValid = true;
  }

  return hasValid ? result : undefined;
}

export function readStreamDebugEvent(parsed: unknown): StreamDebugEvent {
  const root = asRecord(parsed);
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const choice = choices.length > 0 ? asRecord(choices[0]) : {};
  const delta = asRecord(choice.delta);

  const reasoningDelta = readNonEmptyString(delta.reasoning_content)
    ?? readNonEmptyString(delta.reasoning);
  const usage = readTokenUsage(root.usage);
  const finishReason = readNonEmptyString(choice.finish_reason);

  return {
    ...(reasoningDelta ? { reasoningDelta } : {}),
    ...(usage ? { usage } : {}),
    ...(finishReason ? { finishReason } : {})
  };
}
