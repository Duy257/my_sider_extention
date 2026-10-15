// === XỬ LÝ LỖI STREAM AI ===

import {
  APICallError,
  InvalidResponseDataError,
  JSONParseError,
  TypeValidationError,
} from "ai";

// Ánh xạ các lỗi phát sinh trong quá trình stream sang thông báo thân thiện với người dùng
// Trả về chuỗi rỗng nếu lỗi do người dùng hủy (AbortError)
export function mapStreamError(error: unknown): string {
  // Người dùng chủ động hủy request — không cần thông báo lỗi
  if (error instanceof DOMException && error.name === "AbortError") return "";
  // Request timeout — provider quá chậm hoặc không khả dụng
  if (error instanceof DOMException && error.name === "TimeoutError") return "Request timed out. The provider is too slow or unreachable.";
  // Lỗi mạng — kiểm tra kết nối internet
  if (error instanceof TypeError) return "Network error. Check your internet connection.";
  // Dữ liệu trả về không đúng định dạng
  if (error instanceof SyntaxError) return "Received malformed data from the AI provider.";
  // Các lỗi Error thông thường — lấy message gốc
  if (error instanceof Error && error.message.trim()) return error.message;
  // Lỗi không xác định — hướng dẫn chung
  return "AI request failed. Check your API key, model, network, and quota.";
}

// === PHÂN LOẠI LỖI TỪ AI SDK ===
// Mỗi hàm trong client.ts tự chọn thông báo theo loại lỗi (giữ nguyên chuỗi lỗi cũ)
export type AiErrorInfo =
  | { kind: "http"; status: number; providerMessage?: string; responseBody?: string } // provider trả HTTP lỗi
  | { kind: "network" }        // không kết nối được tới provider
  | { kind: "invalid-json" }   // response không phải JSON
  | { kind: "invalid-format" } // JSON không đúng cấu trúc OpenAI-style
  | { kind: "other" };         // lỗi khác (abort, timeout, ...) — dùng mapStreamError

// Đọc error.message từ body lỗi kiểu OpenAI: { "error": { "message": "..." } }
function readProviderErrorMessage(responseBody?: string): string | undefined {
  if (!responseBody) return undefined;
  try {
    const parsed = JSON.parse(responseBody) as { error?: { message?: unknown } } | null;
    const message = parsed?.error?.message;
    return typeof message === "string" && message ? message : undefined;
  } catch {
    return undefined;
  }
}

export function classifyAiError(error: unknown): AiErrorInfo {
  if (JSONParseError.isInstance(error)) return { kind: "invalid-json" };
  if (TypeValidationError.isInstance(error) || InvalidResponseDataError.isInstance(error)) {
    return { kind: "invalid-format" };
  }
  if (APICallError.isInstance(error)) {
    // Không có status code: request không tới được provider
    if (error.statusCode == null) return { kind: "network" };
    // HTTP 2xx nhưng body không parse được
    if (error.statusCode >= 200 && error.statusCode < 300) {
      return JSONParseError.isInstance(error.cause) ? { kind: "invalid-json" } : { kind: "invalid-format" };
    }
    return {
      kind: "http",
      status: error.statusCode,
      providerMessage: readProviderErrorMessage(error.responseBody),
      responseBody: error.responseBody,
    };
  }
  if (error instanceof TypeError) return { kind: "network" };
  return { kind: "other" };
}
