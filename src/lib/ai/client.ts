// === AI CLIENT — HTTP Request, Streaming, Kiểm tra kết nối, Lấy danh sách Model ===

import { mapStreamError } from "./stream";
import type { AiMessage } from "./types";

// Thời gian timeout mặc định cho mọi request AI: 30 giây
const REQUEST_TIMEOUT = 30_000;

// Tạo headers HTTP cho request AI
// - Nếu có API key: thêm header Authorization Bearer
// - Nếu includeJson: thêm Content-Type application/json
function createHeaders(apiKey?: string, includeJson = false): Record<string, string> {
  const headers: Record<string, string> = includeJson ? { "Content-Type": "application/json" } : {};
  const trimmed = apiKey?.trim();
  if (trimmed) headers.Authorization = `Bearer ${trimmed}`;
  return headers;
}

// Tạo AbortSignal với timeout
// Trả về signal và hàm clear để dọn dẹp timer
function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  const clear = () => clearTimeout(timer);
  return { signal: controller.signal, clear };
}

// fetch() tích hợp sẵn timeout
// Kết hợp signal từ caller (nếu có) với signal timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number },
): Promise<Response> {
  const timeout = options.timeout ?? REQUEST_TIMEOUT;
  const { signal: timeoutSignal, clear } = createTimeoutSignal(timeout);
  try {
    const combinedSignal = options.signal
      ? combineAbortSignals(options.signal, timeoutSignal)
      : timeoutSignal;
    return await fetch(url, { ...options, signal: combinedSignal });
  } finally {
    clear(); // Luôn dọn timer, kể cả khi thành công hay lỗi
  }
}

// Kết hợp nhiều AbortSignal thành một signal duy nhất
// Nếu bất kỳ signal nào bị abort, signal tổng hợp cũng bị abort
function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    // Nếu signal đã bị abort ngay từ đầu, abort ngay lập tức
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    // Lắng nghe sự kiện abort trên từng signal
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

// Callbacks cho quá trình stream AI
type StreamCallbacks = {
  onDelta: (delta: string) => void;   // nhận được một phần nội dung text
  onDone: () => void;                  // stream hoàn tất
  onError: (message: string) => void;  // có lỗi xảy ra
};

// === STREAM CHAT COMPLETION ===
// Gửi request chat completions với stream=true, đọc dữ liệu SSE (Server-Sent Events)
// và gọi callback tương ứng cho từng sự kiện
export async function streamChatCompletion(input: {
  baseUrl: string;          // URL endpoint chat completions
  apiKey?: string;          // API key (nếu có)
  model: string;            // tên model
  messages: AiMessage[];    // lịch sử hội thoại
  signal?: AbortSignal;     // signal để hủy request từ bên ngoài
  callbacks: StreamCallbacks;
}): Promise<void> {
  try {
    // Gửi POST request với timeout
    const response = await fetchWithTimeout(input.baseUrl, {
      method: "POST",
      signal: input.signal,
      headers: createHeaders(input.apiKey, true),
      body: JSON.stringify({
        model: input.model,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true // Bật chế độ streaming SSE
      })
    });

    // Xử lý lỗi HTTP (status không phải 2xx)
    if (!response.ok) {
      let errorMessage = `Request failed with HTTP ${response.status}.`;
      try {
        // Thử parse body lỗi để lấy message chi tiết từ provider
        const errorBody = await response.text();
        const parsed = JSON.parse(errorBody);
        if (parsed?.error?.message) {
          errorMessage = parsed.error.message;
        }
      } catch {}
      input.callbacks.onError(errorMessage);
      return;
    }

    // Kiểm tra response body có tồn tại không
    if (!response.body) {
      input.callbacks.onError("No response body received from the AI provider.");
      return;
    }

    // === ĐỌC STREAM SSE (Server-Sent Events) ===
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ""; // Buffer cho các dòng SSE chưa hoàn chỉnh

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Giải mã chunk byte thành text, stream: true giữ lại ký tự chưa hoàn chỉnh
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Dòng cuối có thể chưa hoàn chỉnh, giữ lại

      // Xử lý từng dòng SSE
      for (const rawLine of lines) {
        const line = rawLine.trim();

        // SSE: mỗi sự kiện bắt đầu bằng "data: "
        if (!line.startsWith("data: ")) continue;
        const data = line.slice("data: ".length);

        // Tín hiệu kết thúc stream
        if (data === "[DONE]") {
          try { input.callbacks.onDone(); } catch {}
          return;
        }

        // Parse JSON và extract nội dung delta
        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            try { input.callbacks.onDelta(delta); } catch {}
          }
        } catch {
          // Bỏ qua các dòng JSON không parse được
        }
      }
    }

    // Stream kết thúc tự nhiên (không có [DONE])
    try { input.callbacks.onDone(); } catch {}
  } catch (error) {
    // Xử lý lỗi: ánh xạ sang thông báo thân thiện
    const mapped = mapStreamError(error);
    if (mapped) {
      try { input.callbacks.onError(mapped); } catch {}
    } else {
      // Lỗi bị hủy (AbortError) — không cần thông báo
      try { input.callbacks.onDone(); } catch {}
    }
  }
}

// === KIỂM TRA KẾT NỐI ===
// Gửi một request đơn giản (không stream) để kiểm tra provider có hoạt động không
export async function testConnection(input: {
  baseUrl: string;
  apiKey?: string;
  model: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetchWithTimeout(input.baseUrl, {
      method: "POST",
      headers: createHeaders(input.apiKey, true),
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 10,
        stream: false
      })
    });

    // Xử lý lỗi HTTP
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}.`;
      try {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error?.message) errorMessage = parsed.error.message;
        } catch {
          // Nếu response không phải JSON, dùng text gốc (nếu ngắn)
          if (text && text.length < 200) errorMessage = text;
        }
      } catch {}
      return { ok: false, error: errorMessage };
    }

    // Parse JSON response
    let body: any;
    try {
      body = await response.json();
    } catch {
      return { ok: false, error: "Provider returned a non-JSON response. Check the URL." };
    }

    // Kiểm tra cấu trúc response có đúng định dạng OpenAI-style không
    if (!body?.choices?.[0]?.message) {
      return { ok: false, error: "Provider returned an unexpected response format." };
    }

    return { ok: true };
  } catch (error) {
    // Phân loại lỗi mạng vs lỗi khác
    const msg = error instanceof TypeError
      ? "Could not reach the provider. Check the URL."
      : error instanceof Error ? error.message : "Unknown error.";
    return { ok: false, error: msg };
  }
}

// === LẤY DANH SÁCH MODEL ===
// Gọi API models của provider để lấy danh sách model khả dụng
export async function fetchModels(input: {
  modelUrl: string;   // URL endpoint lấy danh sách model
  apiKey?: string;    // API key (nếu cần)
}): Promise<{ models: string[] } | { error: string }> {
  try {
    const response = await fetchWithTimeout(input.modelUrl, {
      headers: createHeaders(input.apiKey)
    });

    // Xử lý lỗi HTTP
    if (!response.ok) {
      let msg = `HTTP ${response.status}.`;
      try {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error?.message) msg = parsed.error.message;
        } catch {
          if (text && text.length < 200) msg = text;
        }
      } catch {}
      return { error: msg };
    }

    // Parse JSON
    let body: any;
    try {
      body = await response.json();
    } catch {
      return { error: "Provider returned a non-JSON models response." };
    }

    // Trích xuất danh sách model từ body.data (theo chuẩn OpenAI API)
    // Lọc bỏ giá trị rỗng, loại bỏ trùng lặp, sắp xếp A-Z
    const models: string[] = Array.from(new Set((body?.data ?? [])
      .map((model: { id?: unknown }) => (typeof model.id === "string" ? model.id.trim() : ""))
      .filter(Boolean)))
      .sort() as string[];

    if (models.length === 0) return { error: "No models returned by the provider." };
    return { models };
  } catch (error) {
    const msg = error instanceof TypeError
      ? "Could not reach the provider. Check the URL."
      : error instanceof Error ? error.message : "Unknown error.";
    return { error: msg };
  }
}

