// === TẠO LANGUAGE MODEL (AI SDK) TỪ CẤU HÌNH PROVIDER ===

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { fetchWithTimeout, resolveRequestHeaders } from "./http";

// providers.json lưu URL đầy đủ ".../chat/completions"; AI SDK cần base URL
export function toApiBaseUrl(chatCompletionsUrl: string): string {
  return chatCompletionsUrl.replace(/\/chat\/completions\/?$/, "");
}

// Tạo model OpenAI-compatible cho một request
// - apiKey rỗng: AI SDK không gửi header Authorization (LMStudio)
// - extraBodyParams (thinking, stream_options...) được merge nguyên trạng vào request body
export function createLanguageModel(input: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  headers?: Record<string, string>;
  sessionId?: string;
  extraBodyParams?: Record<string, unknown>;
}): LanguageModel {
  const extraBodyParams = input.extraBodyParams;
  const provider = createOpenAICompatible({
    name: "custom",
    baseURL: toApiBaseUrl(input.baseUrl),
    apiKey: input.apiKey?.trim() || undefined,
    headers: resolveRequestHeaders({
      baseUrl: input.baseUrl,
      headers: input.headers,
      sessionId: input.sessionId,
    }),
    fetch: (url, init) => {
      // Bỏ header user-agent do AI SDK tự thêm để request giống hệt trước khi migrate
      const { "user-agent": _userAgent, ...headers } = (init?.headers ?? {}) as Record<string, string>;
      return fetchWithTimeout(String(url), { ...init, headers });
    },
    transformRequestBody: extraBodyParams
      ? (body) => ({ ...body, ...extraBodyParams })
      : undefined,
  });
  return provider.chatModel(input.model);
}
