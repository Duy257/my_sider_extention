import type { Settings } from "../storage/types";

export type DevSurface = "sidepanel" | "floating" | "reader";
export type AiDevFeature =
  | "chat"
  | "selection-response"
  | "reader-summary"
  | "reader-qa"
  | "reader-definition";
export type DevStatus = "pending" | "success" | "error" | "cancelled" | "interrupted";

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ThinkingTrace = {
  state: "pending" | "returned" | "not-returned" | "unsupported";
  content: string;
};

export type AiDevContext = {
  surface: DevSurface;
  feature: AiDevFeature;
};

export type AiDevTrace = {
  requestId: string;
  surface: DevSurface;
  feature: AiDevFeature;
  status: DevStatus;
  providerId: string;
  model: string;
  requestedThinkingMode: Settings["thinkingMode"];
  effectiveRequestParams: Record<string, unknown>;
  startedAt: number;
  firstTokenAt?: number;
  finishedAt?: number;
  finishReason?: string;
  thinking: ThinkingTrace;
  usage?: TokenUsage;
  error?: string;
};

export type ToolDevTrace = {
  requestId: string;
  tool: "read-page" | "selection-action" | "open-reader";
  status: DevStatus;
  startedAt: number;
  finishedAt?: number;
  metadata: Record<string, string | number | boolean>;
  error?: string;
};
