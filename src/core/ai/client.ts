// === AI CLIENT — Streaming, Completion, Kiểm tra kết nối, Lấy danh sách Model ===
// Chat completion đi qua Vercel AI SDK (streamText / generateText);
// danh sách model vẫn gọi trực tiếp endpoint /models.

import { generateText, streamText, type LanguageModelUsage } from "ai";
import { classifyAiError, mapStreamError } from "./stream";
import { createLanguageModel } from "./model";
import { fetchWithTimeout, resolveRequestHeaders } from "./http";
import type { AiMessage } from "./types";
import type { TokenUsage } from "../devtools/types";
import { TIMEOUTS } from "../../constants";

// Thời gian chờ token đầu tiên, tính từ lúc nhận được response headers
const FIRST_TOKEN_TIMEOUT = TIMEOUTS.AI_FIRST_TOKEN;

// === KIỂU DỮ LIỆU RESPONSE TỪ PROVIDER (OpenAI-style) ===
type ProviderErrorPayload = {
  error?: { message?: string };
};

// Body của endpoint /models
type ModelsResponseBody = ProviderErrorPayload & {
  data?: Array<{ id?: unknown; name?: unknown }>;
};

export type ModelEntry = { id: string; label: string };

// Cấu hình chung cho một request chat completion
type CompletionRequest = {
  baseUrl: string; // URL endpoint chat completions
  apiKey?: string; // API key (nếu có)
  model: string; // tên model
  extraBodyParams?: Record<string, unknown>; // param thô merge vào body (thinking, stream_options...)
  headers?: Record<string, string>;
  sessionId?: string;
};

// Callbacks cho quá trình stream AI
type StreamCallbacks = {
  onConnecting?: () => void; // đang kết nối đến provider
  onFirstToken?: (kind: "reasoning" | "text") => void; // nhận được token đầu tiên (reasoning hoặc text)
  onDelta: (delta: string) => void; // nhận được một phần nội dung text
  onReasoningDelta?: (delta: string) => void;
  onUsage?: (usage: TokenUsage) => void;
  onFinishReason?: (finishReason: string) => void;
  onDone: () => void; // stream hoàn tất
  onError: (message: string) => void; // có lỗi xảy ra
};

// Gọi callback mà không để lỗi của caller làm hỏng vòng đọc stream
function safeInvoke(fn: () => void): void {
  try {
    fn();
  } catch {}
}

// Chuyển usage của AI SDK sang TokenUsage, chỉ giữ số nguyên không âm
function toTokenUsage(usage: LanguageModelUsage | undefined): TokenUsage | undefined {
  if (!usage) return undefined;
  const isValidNumber = (val: unknown): val is number =>
    typeof val === "number" && Number.isInteger(val) && val >= 0;

  const result: TokenUsage = {};
  if (isValidNumber(usage.inputTokens)) result.inputTokens = usage.inputTokens;
  if (isValidNumber(usage.outputTokens)) result.outputTokens = usage.outputTokens;
  if (isValidNumber(usage.totalTokens)) result.totalTokens = usage.totalTokens;
  return Object.keys(result).length > 0 ? result : undefined;
}

// === STREAM CHAT COMPLETION ===
// Gửi request chat completions với stream=true qua AI SDK
// và gọi callback tương ứng cho từng part của fullStream
export async function streamChatCompletion(input: CompletionRequest & {
  messages: AiMessage[]; // lịch sử hội thoại
  signal?: AbortSignal; // signal để hủy request từ bên ngoài
  callbacks: StreamCallbacks;
}): Promise<void> {
  const { callbacks } = input;
  let hasReceivedFirstToken = false;

  function markFirstActivity(kind: "reasoning" | "text") {
    if (hasReceivedFirstToken) return;
    hasReceivedFirstToken = true;
    safeInvoke(() => callbacks.onFirstToken?.(kind));
  }

  try {
    const result = streamText({
      model: createLanguageModel(input),
      messages: input.messages,
      allowSystemInMessages: true, // prompt builders đặt system message trong mảng messages
      abortSignal: input.signal,
      maxRetries: 0, // không retry: báo lỗi ngay, tránh bị tính phí lặp
      timeout: { firstChunkMs: FIRST_TOKEN_TIMEOUT },
      onError: () => {}, // lỗi được xử lý qua part "error" bên dưới
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        // Provider đã trả response 2xx, bắt đầu đọc stream
        case "start-step":
          safeInvoke(() => callbacks.onConnecting?.());
          break;

        case "reasoning-delta":
          if (part.text) {
            markFirstActivity("reasoning");
            safeInvoke(() => callbacks.onReasoningDelta?.(part.text));
          }
          break;

        case "text-delta":
          if (part.text) {
            markFirstActivity("text");
            safeInvoke(() => callbacks.onDelta(part.text));
          }
          break;

        case "finish": {
          const usage = toTokenUsage(part.totalUsage);
          if (usage) safeInvoke(() => callbacks.onUsage?.(usage));
          // rawFinishReason giữ nguyên giá trị provider trả về (stop, length, content_filter...)
          const finishReason = part.rawFinishReason;
          if (finishReason) safeInvoke(() => callbacks.onFinishReason?.(finishReason));
          break;
        }

        case "error": {
          const info = classifyAiError(part.error);
          // Chunk lỗi định dạng giữa stream — bỏ qua và đọc tiếp như parser SSE cũ
          if (info.kind === "invalid-json" || info.kind === "invalid-format") break;
          const message =
            info.kind === "http"
              ? info.providerMessage ?? `Request failed with HTTP ${info.status}.`
              : info.kind === "network"
                ? "Network error. Check your internet connection."
                : mapStreamError(part.error);
          if (message) {
            safeInvoke(() => callbacks.onError(message));
          } else {
            safeInvoke(() => callbacks.onDone());
          }
          return;
        }

        case "abort":
          // Người dùng hủy (port disconnect) — không cần thông báo
          if (input.signal?.aborted) return;
          // Ngược lại là hết thời gian chờ token đầu tiên
          safeInvoke(() =>
            callbacks.onError(
              `Provider is too slow. No response after ${FIRST_TOKEN_TIMEOUT / 1000} seconds.`,
            ),
          );
          return;
      }
    }

    safeInvoke(() => callbacks.onDone());
  } catch (error) {
    // Xử lý lỗi: ánh xạ sang thông báo thân thiện
    const mapped = mapStreamError(error);
    if (mapped) {
      safeInvoke(() => callbacks.onError(mapped));
    } else {
      // Lỗi bị hủy (AbortError) — không cần thông báo
      safeInvoke(() => callbacks.onDone());
    }
  }
}

// === NON-STREAM COMPLETION (for inline definitions) ===
export async function fetchCompletion(input: CompletionRequest & {
  messages: AiMessage[];
  signal?: AbortSignal;
}): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  try {
    const result = await generateText({
      model: createLanguageModel(input),
      messages: input.messages,
      allowSystemInMessages: true,
      abortSignal: input.signal,
      maxRetries: 0,
    });
    return { ok: true, content: result.text };
  } catch (error) {
    const info = classifyAiError(error);
    switch (info.kind) {
      case "http":
        return { ok: false, error: info.providerMessage ?? `HTTP ${info.status}.` };
      case "invalid-json":
        return { ok: false, error: "Provider returned a non-JSON response." };
      case "invalid-format":
        return { ok: false, error: "Provider returned an unexpected response format." };
      default:
        return { ok: false, error: error instanceof Error ? error.message : "Unknown error." };
    }
  }
}

// === KIỂM TRA KẾT NỐI ===
// Gửi một request đơn giản (không stream) để kiểm tra provider có hoạt động không
export async function testConnection(
  input: CompletionRequest,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await generateText({
      model: createLanguageModel(input),
      prompt: "Hi",
      maxOutputTokens: 10,
      maxRetries: 0,
    });
    return { ok: true };
  } catch (error) {
    const info = classifyAiError(error);
    switch (info.kind) {
      case "http": {
        // Nếu response không phải JSON, dùng text gốc (nếu ngắn)
        const body = info.responseBody;
        const fallback = body && body.length < 200 ? body : `HTTP ${info.status}.`;
        return { ok: false, error: info.providerMessage ?? fallback };
      }
      case "network":
        return { ok: false, error: "Could not reach the provider. Check the URL." };
      case "invalid-json":
        return { ok: false, error: "Provider returned a non-JSON response. Check the URL." };
      case "invalid-format":
        return { ok: false, error: "Provider returned an unexpected response format." };
      default:
        return { ok: false, error: error instanceof Error ? error.message : "Unknown error." };
    }
  }
}

// === LẤY DANH SÁCH MODEL ===
// Gọi API models của provider để lấy danh sách model khả dụng
export async function fetchModels(input: {
  modelUrl: string; // URL endpoint lấy danh sách model
  apiKey?: string; // API key (nếu cần)
  headers?: Record<string, string>;
  sessionId?: string;
}): Promise<{ models: ModelEntry[] } | { error: string }> {
  try {
    const response = await fetchWithTimeout(input.modelUrl, {
      headers: resolveRequestHeaders({
        baseUrl: input.modelUrl,
        apiKey: input.apiKey,
        includeJson: false,
        headers: input.headers,
        sessionId: input.sessionId,
      }),
    });

    // Xử lý lỗi HTTP
    if (!response.ok) {
      let msg = `HTTP ${response.status}.`;
      try {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text) as ProviderErrorPayload | null;
          if (parsed?.error?.message) msg = parsed.error.message;
        } catch {
          if (text && text.length < 200) msg = text;
        }
      } catch {}
      return { error: msg };
    }

    // Parse JSON
    let body: ModelsResponseBody;
    try {
      body = (await response.json()) as ModelsResponseBody;
    } catch {
      return { error: "Provider returned a non-JSON models response." };
    }

    // Trích xuất danh sách model từ body.data (theo chuẩn OpenAI API)
    // Map mỗi entry thành { id, label }; label ưu tiên `name`, fallback về `id`
    // Lọc bỏ entry thiếu id, loại bỏ trùng lặp, sắp xếp theo id A-Z
    const models: ModelEntry[] = Array.from(
      new Map(
        (body?.data ?? [])
          .map((entry) => {
            const id = typeof entry.id === "string" ? entry.id.trim() : "";
            if (!id) return null;
            const name = typeof entry.name === "string" ? entry.name.trim() : "";
            return [id, { id, label: name || id } as ModelEntry] as const;
          })
          .filter((entry): entry is readonly [string, ModelEntry] => entry !== null),
      ).values(),
    ).sort((a, b) => a.id.localeCompare(b.id));

    if (models.length === 0)
      return { error: "No models returned by the provider." };
    return { models };
  } catch (error) {
    const msg =
      error instanceof TypeError
        ? "Could not reach the provider. Check the URL."
        : error instanceof Error
          ? error.message
          : "Unknown error.";
    return { error: msg };
  }
}
