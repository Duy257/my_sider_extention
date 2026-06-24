import { DEFAULT_OPENAI_MODEL } from "./models";
import type { AiStreamEvent } from "./types";

export function resolveSelectedModel(modelPreset?: string, customModel?: string): string {
  const custom = customModel?.trim();
  if (custom) return custom;
  return modelPreset?.trim() || DEFAULT_OPENAI_MODEL;
}

export function extractResponseTextDelta(event: AiStreamEvent): string {
  if (event.type !== "response.output_text.delta") return "";
  return typeof event.delta === "string" ? event.delta : "";
}

export function mapOpenAIError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "OpenAI request failed. Check your API key, model, network, and quota.";
}
