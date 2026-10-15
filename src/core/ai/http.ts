// === HTTP HELPERS DÙNG CHUNG CHO AI MODULE — Headers, Timeout, AbortSignal ===

import { TIMEOUTS } from "../../constants";

// Thời gian timeout mặc định cho mọi request AI (tính tới khi nhận được response headers)
export const REQUEST_TIMEOUT = TIMEOUTS.AI_REQUEST;

// Tạo headers HTTP cho request AI
// - Nếu có API key: thêm header Authorization Bearer
// - Nếu includeJson: thêm Content-Type application/json
// - Nếu có extraHeaders: merge vào headers
function createHeaders(
  apiKey?: string,
  includeJson = false,
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = includeJson
    ? { "Content-Type": "application/json" }
    : {};
  const trimmed = apiKey?.trim();
  if (trimmed) headers.Authorization = `Bearer ${trimmed}`;
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }
  return headers;
}

// Resolve request headers, tự động thêm x-opencode-session nếu là OpenCode endpoint
export function resolveRequestHeaders(options: {
  baseUrl: string;
  apiKey?: string;
  includeJson?: boolean;
  headers?: Record<string, string>;
  sessionId?: string;
}): Record<string, string> {
  const extraHeaders: Record<string, string> = { ...(options.headers ?? {}) };

  // Tự động đảm bảo x-opencode-session cho OpenCode
  const isOpenCode = options.baseUrl.toLowerCase().includes("opencode.ai");
  if (options.sessionId && !extraHeaders["x-opencode-session"]) {
    extraHeaders["x-opencode-session"] = options.sessionId;
  } else if (isOpenCode && !extraHeaders["x-opencode-session"]) {
    extraHeaders["x-opencode-session"] = crypto.randomUUID();
  }

  return createHeaders(
    options.apiKey,
    options.includeJson ?? false,
    extraHeaders,
  );
}

// Tạo AbortSignal với timeout
// Trả về signal và hàm clear để dọn dẹp timer
function createTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(new DOMException("Request timed out", "TimeoutError")),
    timeoutMs,
  );
  const clear = () => clearTimeout(timer);
  return { signal: controller.signal, clear };
}

// fetch() tích hợp sẵn timeout
// Kết hợp signal từ caller (nếu có) với signal timeout
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number },
): Promise<Response> {
  const timeout = options.timeout ?? REQUEST_TIMEOUT;
  const { signal: timeoutSignal, clear: clearTimer } =
    createTimeoutSignal(timeout);
  const combined = options.signal
    ? createCombinedAbortSignal(options.signal, timeoutSignal)
    : { signal: timeoutSignal, cleanup: () => {} };

  try {
    return await fetch(url, { ...options, signal: combined.signal });
  } finally {
    clearTimer();
    combined.cleanup();
  }
}

// Kết hợp nhiều AbortSignal thành một signal duy nhất
// Nếu bất kỳ signal nào bị abort, signal tổng hợp cũng bị abort
// Trả về cả cleanup function để dọn dẹp event listener
function createCombinedAbortSignal(...signals: AbortSignal[]): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const handlers: Array<{ signal: AbortSignal; handler: () => void }> = [];

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      for (const { signal: s, handler: h } of handlers) {
        s.removeEventListener("abort", h);
      }
      return { signal: controller.signal, cleanup: () => {} };
    }
    const handler = () => controller.abort(signal.reason);
    signal.addEventListener("abort", handler, { once: true });
    handlers.push({ signal, handler });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      for (const { signal: s, handler: h } of handlers) {
        s.removeEventListener("abort", h);
      }
    },
  };
}
