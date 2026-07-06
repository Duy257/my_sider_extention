# AI Loading Optimization — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Eliminate perceived "loading lâu" khi gọi AI model bằng cách thêm TTFT watchdog, phân biệt trạng thái UI, cache settings, và cleanup abort signals.

**Architecture:** Sửa 3 layer: `client.ts` (core AI HTTP), `background.ts` (service worker gateway), `App.tsx` (UI layer). Mỗi layer changes riêng biệt, thứ tự thực hiện chặt chẽ.

**Tech Stack:** TypeScript, Chrome Extension API (runtime port, storage), React 19

**Files chạm tới:**
- `src/lib/ai/client.ts` — TTFT watchdog, abort cleanup, connecting/firstToken callbacks
- `src/lib/messaging/types.ts` — Add connecting/firstToken response types
- `entrypoints/background.ts` — Cache settings + forward connecting/firstToken events
- `entrypoints/sidepanel/App.tsx` — UI phase indicator
- `entrypoints/sidepanel/components/ChatMessage.tsx` — TypingIndicator phase prop

**Thứ tự thực hiện:** A → B → C → D (không thể đảo). Mỗi task đều có `npm run compile` verify.

---

### Task A: Client core — callbacks + watchdog + signal cleanup

**Objective:** Sửa `src/lib/ai/client.ts`: add optional connecting/firstToken callbacks, TTFT watchdog timer, cleanup combineAbortSignals listener. Gộp 3 thay đổi vào 1 task vì chúng cùng file và có logic đan xen.

**Files:**
- Modify: `src/lib/ai/client.ts`

**Step 1: Đọc file hiện tại**

Đọc `src/lib/ai/client.ts` để biết chính xác code. Lưu ý các sections:
- `type StreamCallbacks` (dòng ~63)
- function `createTimeoutSignal` (dòng ~21)
- function `combineAbortSignals` (dòng ~48)
- function `fetchWithTimeout` (dòng ~30)
- function `streamChatCompletion` (dòng ~72)

**Step 2: Fix memory leak — refactor `combineAbortSignals` thành `createCombinedAbortSignal`**

Đổi signature từ `combineAbortSignals(...signals): AbortSignal` thành `createCombinedAbortSignal(...signals): { signal: AbortSignal; cleanup: () => void }`.

```typescript
function createCombinedAbortSignal(
  ...signals: AbortSignal[]
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const handlers: Array<{ signal: AbortSignal; handler: () => void }> = [];

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      // cleanup những listener đã add
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
    }
  };
}
```

**Step 3: Update `fetchWithTimeout` dùng `createCombinedAbortSignal`**

```typescript
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number },
): Promise<Response> {
  const timeout = options.timeout ?? REQUEST_TIMEOUT;
  const { signal: timeoutSignal, clear: clearTimer } = createTimeoutSignal(timeout);
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
```

**Step 4: Giảm REQUEST_TIMEOUT từ 30s xuống 20s**

```typescript
const REQUEST_TIMEOUT = 20_000;
```

**Step 5: Thêm FIRST_TOKEN_TIMEOUT constant**

```typescript
const FIRST_TOKEN_TIMEOUT = 15_000;
```

**Step 6: Update `mapStreamError` để nhận ra watchdog timeout**

File: `src/lib/ai/stream.ts`

Thêm check cho watchdog-specific error message:

```typescript
export function mapStreamError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  if (error instanceof DOMException && error.name === "TimeoutError") return "Request timed out. The provider is too slow or unreachable.";
  if (error instanceof TypeError) return "Network error. Check your internet connection.";
  if (error instanceof SyntaxError) return "Received malformed data from the AI provider.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return "AI request failed. Check your API key, model, network, and quota.";
}
```

**Step 7: Thêm optional callbacks vào `StreamCallbacks` type**

```typescript
type StreamCallbacks = {
  onConnecting?: () => void;     // optional! để không break code cũ
  onFirstToken?: () => void;     // optional! để không break code cũ
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};
```

**Step 8: Update `streamChatCompletion` — connecting signal**

Sau khi fetch thành công và kiểm tra `response.ok` + `response.body`, gọi `onConnecting`:

```typescript
// Sau dòng: if (!response.body) { ... }
// Trước vòng lặp while(true):
try { input.callbacks.onConnecting?.(); } catch {}
```

**Step 9: Update `streamChatCompletion` — firstToken signal + watchdog**

Thêm flag + watchdog timer. Watchdog KHÔNG tự gọi `onError` — chỉ abort `watchdogController`. Khi fetch bị abort, catch block sẽ gọi `mapStreamError`. Nếu watchdog abort, `error.message` chứa `"No response from provider after 15 seconds."`, và vì nó không phải AbortError (nó là Error với message custom), `mapStreamError` sẽ trả về message đó.

```typescript
let hasReceivedFirstToken = false;
// Watchdog timer — chỉ set khi onConnecting đã được gọi
const watchdogTimer = setTimeout(() => {
  // Nếu chưa có first token, abort bằng error message rõ ràng
  // Lưu ý: dùng Error, không DOMException.TimeoutError — để mapStreamError
  // trả về message gốc thay vì "Request timed out" generic
  watchdogController.abort(new Error("Provider is too slow. No response after 15 seconds."));
}, FIRST_TOKEN_TIMEOUT);

// Trong vòng lặp SSE, khi có delta content đầu tiên:
if (delta && !hasReceivedFirstToken) {
  hasReceivedFirstToken = true;
  clearTimeout(watchdogTimer);
  try { input.callbacks.onFirstToken?.(); } catch {}
}
```

**Cần thêm:** `const watchdogController = new AbortController();` trước `watchdogTimer`.

**Step 10: Pass `watchdogController.signal` vào fetch's combined signal**

```typescript
const combined = options.signal
  ? createCombinedAbortSignal(options.signal, timeoutSignal, watchdogController.signal)
  : createCombinedAbortSignal(timeoutSignal, watchdogController.signal);
```

Nhưng `fetchWithTimeout` không biết về watchdog. **Cách làm:** không pass watchdog vào `fetchWithTimeout`. Thay vào đó, watchdog chỉ abort controller, và ta check `watchdogController.signal.aborted` trong stream loop. Nhưng nếu watchdog abort trước khi fetch trả response, fetch vẫn chạy tiếp.

**Cách đúng:** watchdog abort sẽ được catch ở try-catch ngoài của `streamChatCompletion`. Nếu watchdog abort khi fetch đang chờ response, fetch sẽ reject với abort reason → catch block bắt được.

**Simplify:** không tạo `watchdogController` riêng. Dùng AbortController của fetch luôn:

```typescript
// Sau onConnecting, tạo timer đơn giản:
const watchdogTimer = setTimeout(() => {
  controller.abort(new Error("Provider is too slow. No response after 15 seconds."));
}, FIRST_TOKEN_TIMEOUT);

// Khi có first token:
if (delta && !hasReceivedFirstToken) {
  hasReceivedFirstToken = true;
  clearTimeout(watchdogTimer); // cleanup watchdog
  try { input.callbacks.onFirstToken?.(); } catch {}
}

// Cuối cùng, cleanup watchdog trong finally:
finally {
  clearTimeout(watchdogTimer);
  // ...
}
```

Trong `background.ts`, `controller` là `new AbortController()` tạo trong port handler. Watchdog abort controller này → fetch bị abort → catch block gọi `mapStreamError` → vì là Error (không phải DOMException), `mapStreamError` trả về `error.message` → "Provider is too slow. No response after 15 seconds.".

**Nhưng:** `controller` đã được dùng cho `port.onDisconnect` cleanup. Cần đảm bảo watchdog abort không gây xung đột với port disconnect.

Cách clean nhất: dùng AbortController riêng cho watchdog, combine với fetch signal trong `fetchWithTimeout`.

**Quyết định:** Dùng AbortController riêng (`watchdogController`), combine với signal trong `fetchWithTimeout` via `createCombinedAbortSignal`. Điều chỉnh `fetchWithTimeout` để nhận thêm external signal array.

**Actual implementation trong `streamChatCompletion`:**

```typescript
export async function streamChatCompletion(input: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: AiMessage[];
  signal?: AbortSignal;
  callbacks: StreamCallbacks;
}): Promise<void> {
  const watchdogController = new AbortController();
  let hasReceivedFirstToken = false;

  try {
    const response = await fetchWithTimeout(input.baseUrl, {
      method: "POST",
      signal: input.signal
        ? createCombinedAbortSignal(input.signal, watchdogController.signal)
        : watchdogController.signal,
      headers: createHeaders(input.apiKey, true),
      body: JSON.stringify({
        model: input.model,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true
      })
    });

    // fetch thành công → gọi onConnecting
    if (!response.ok) { /* ... error handling ... */ return; }
    if (!response.body) { /* ... error handling ... */ return; }

    try { input.callbacks.onConnecting?.(); } catch {}

    // Start watchdog timer
    const watchdogTimer = setTimeout(() => {
      watchdogController.abort(new Error("Provider is too slow. No response after 15 seconds."));
    }, FIRST_TOKEN_TIMEOUT);

    // Stream loop
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data: ")) continue;
        const data = line.slice("data: ".length);
        if (data === "[DONE]") {
          clearTimeout(watchdogTimer);
          try { input.callbacks.onDone(); } catch {}
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            if (!hasReceivedFirstToken) {
              hasReceivedFirstToken = true;
              clearTimeout(watchdogTimer);
              try { input.callbacks.onFirstToken?.(); } catch {}
            }
            try { input.callbacks.onDelta(delta); } catch {}
          }
        } catch { /* skip unparseable lines */ }
      }
    }

    clearTimeout(watchdogTimer);
    try { input.callbacks.onDone(); } catch {}
  } catch (error) {
    clearTimeout(watchdogTimer);
    const mapped = mapStreamError(error);
    if (mapped) {
      try { input.callbacks.onError(mapped); } catch {}
    } else {
      try { input.callbacks.onDone(); } catch {}
    }
  }
}
```

**Lưu ý:** `fetchWithTimeout` signature hiện tại không nhận external signals ngoài `options.signal`. Ta đang truyền combined signal vào `options.signal` — đó là cách đúng. `fetchWithTimeout` sẽ combine signal này với timeout signal của nó.

Nhưng có issue: `fetchWithTimeout` cũng dùng `createTimeoutSignal` riêng, rồi combine với `options.signal`. Nếu `options.signal` đã là combined (input.signal + watchdog), thì trong `fetchWithTimeout` có 3 layers combine. Hơi redundant nhưng không sai.

**Simplify hơn:** sửa `fetchWithTimeout` để accept thêm external signals array. Hoặc đơn giản nhất: **bỏ `fetchWithTimeout`**, dùng native fetch với `AbortSignal.any()` nếu Chrome >= 116. Extension manifest V3 minimum Chrome 100+.

**Quyết định cuối:** Cứ dùng `fetchWithTimeout` nhưng truyền combined signal (input.signal + watchdog) làm `options.signal`. `fetchWithTimeout` combine nó với timeout signal nữa. Overhead không đáng kể.

**Step 11: Đảm bảo `combineAbortSignals` không còn được dùng ở đâu**

Chạy: `search_files("combineAbortSignals", path="src/lib/ai/")` — xác nhận chỉ còn trong `client.ts`.

Sau đó xóa hàm `combineAbortSignals` cũ và rename tất cả reference sang `createCombinedAbortSignal`.

**Step 12: Type check**

```bash
npm run compile
```
Expected: No errors.

**Step 13: Check test mocks**

Mở `tests/` và kiểm tra các file mock `streamChatCompletion` hoặc `StreamCallbacks`. Nếu test nào render component gọi `sendPrompt`, cần đảm bảo mock vẫn work (vì callbacks mới optional).

---

### Task B: Message types + background worker updates

**Objective:** Thêm `AI_STREAM_CONNECTING` / `AI_STREAM_FIRST_TOKEN` message types, forward từ background worker, và cache settings.

**Files:**
- Modify: `src/lib/messaging/types.ts`
- Modify: `entrypoints/background.ts`

**Step 1: Đọc file hiện tại**

Đọc `src/lib/messaging/types.ts` và `entrypoints/background.ts`.

**Step 2: Add message types vào `AiPortResponse`**

```typescript
export type AiPortResponse =
  | { type: "AI_STREAM_CONNECTING"; requestId: string }
  | { type: "AI_STREAM_FIRST_TOKEN"; requestId: string }
  | { type: "AI_STREAM_CHUNK"; requestId: string; delta: string }
  | { type: "AI_STREAM_DONE"; requestId: string }
  | { type: "AI_STREAM_ERROR"; requestId: string; message: string };
```

**Step 3: Cache settings trong background worker**

Thêm cache layer:

```typescript
// Đầu file, sau các import
import type { Settings } from "../src/lib/storage/types";

let settingsCache: { settings: Settings; timestamp: number } | null = null;
const SETTINGS_CACHE_TTL = 5_000; // 5s

async function getCachedSettings(): Promise<Settings> {
  const now = Date.now();
  if (settingsCache && (now - settingsCache.timestamp) < SETTINGS_CACHE_TTL) {
    return settingsCache.settings;
  }
  const settings = await getSettings();
  settingsCache = { settings, timestamp: now };
  return settings;
}
```

**Step 4: Thay `getSettings()` bằng `getCachedSettings()`**

Trong 2 handler:
- `AI_CHAT_REQUEST`: thay `const settings = await getSettings();` → `const settings = await getCachedSettings();`
- `TEST_CONNECTION`: giữ nguyên `getSettings()` (vì user đang test connection, cần real-time)
- `LOAD_MODELS`: giữ nguyên `getSettings()` (vì user đang ở Settings, cần data mới nhất)

**Step 5: Invalidate cache khi settings thay đổi**

Thêm handler cho `SETTINGS_UPDATED` message trong `chrome.runtime.onMessage`:

```typescript
if (message.type === "SETTINGS_UPDATED") {
  settingsCache = null;
  sendResponse({ ok: true });
  return true;
}
```

**Step 6: Update `streamChatCompletion` callbacks trong `AI_CHAT_REQUEST` handler**

Thêm `onConnecting` và `onFirstToken`:

```typescript
await streamChatCompletion({
  baseUrl: runtime.config.baseUrl,
  apiKey: runtime.config.apiKey,
  model: runtime.config.model,
  messages: message.messages,
  signal: controller.signal,
  callbacks: {
    onConnecting: () =>
      send({ type: "AI_STREAM_CONNECTING", requestId: message.requestId }),
    onFirstToken: () =>
      send({ type: "AI_STREAM_FIRST_TOKEN", requestId: message.requestId }),
    onDelta: (delta) =>
      send({ type: "AI_STREAM_CHUNK", requestId: message.requestId, delta }),
    onDone: () => send({ type: "AI_STREAM_DONE", requestId: message.requestId }),
    onError: (errorMessage) =>
      send({ type: "AI_STREAM_ERROR", requestId: message.requestId, message: errorMessage }),
  }
});
```

**Step 7: Type check**

```bash
npm run compile
```
Expected: No errors.

---

### Task C: UI phase indicator

**Objective:** Sidepanel hiển thị trạng thái "đang kết nối..." → "đang trả lời..." + cancel button khi connecting.

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx`
- Modify: `entrypoints/sidepanel/components/ChatMessage.tsx`

**Step 1: Đọc file hiện tại**

Đọc `App.tsx` (đặc biệt `sendPrompt` function và port listener) và `ChatMessage.tsx` (TypingIndicator).

**Step 2: Thêm phase state + port ref trong App.tsx**

```typescript
type StreamingPhase = "idle" | "connecting" | "streaming";

const [streamingPhase, setStreamingPhase] = useState<StreamingPhase>("idle");
const portRef = useRef<chrome.runtime.Port | null>(null);
```

**Step 3: Update `sendPrompt` — set phase + port ref**

```typescript
function sendPrompt(text: string) {
  if (!settings) return;
  if (streaming) return;
  setError("");
  setStreaming(true);
  setStreamingPhase("connecting"); // Set ngay khi gửi

  const requestId = crypto.randomUUID();
  const assistantId = crypto.randomUUID();
  setMessages((current) => [
    ...current,
    { id: crypto.randomUUID(), role: "user", content: text },
    { id: assistantId, role: "assistant", content: "" }
  ]);

  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: AI_STREAM_PORT });
    portRef.current = port; // Lưu ref
  } catch {
    setStreaming(false);
    setStreamingPhase("idle");
    setError("Không thể kết nối dịch vụ AI.");
    return;
  }

  port.onDisconnect.addListener(() => {
    setStreaming(false);
    setStreamingPhase("idle");
    portRef.current = null;
    if (chrome.runtime.lastError) {
      setError(chrome.runtime.lastError.message || "Mất kết nối.");
    }
  });

  port.onMessage.addListener((message: AiPortResponse) => {
    if (message.requestId !== requestId) return;

    if (message.type === "AI_STREAM_CONNECTING") {
      setStreamingPhase("connecting");
    }

    if (message.type === "AI_STREAM_FIRST_TOKEN") {
      setStreamingPhase("streaming");
    }

    if (message.type === "AI_STREAM_CHUNK") {
      setMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, content: item.content + message.delta } : item))
      );
    }

    if (message.type === "AI_STREAM_DONE") {
      setStreaming(false);
      setStreamingPhase("idle");
      portRef.current = null;
      port.disconnect();
    }

    if (message.type === "AI_STREAM_ERROR") {
      setStreaming(false);
      setStreamingPhase("idle");
      portRef.current = null;
      setError(message.message);
      port.disconnect();
    }
  });

  port.postMessage({
    type: "AI_CHAT_REQUEST",
    requestId,
    messages: buildUserChatMessages(text)
  });
}
```

**Step 4: Update TypingIndicator rendering ở App.tsx**

```typescriptx
{streaming && messages.length > 0 && messages[messages.length - 1].content === "" ? (
  <TypingIndicator phase={streamingPhase} />
) : null}
```

Thay thế dòng hiện tại (dòng ~275).

**Step 5: Update TypingIndicator component**

Update `ChatMessage.tsx`:

```typescriptx
export function TypingIndicator({ phase = "connecting" }: { phase?: "connecting" | "streaming" }) {
  return (
    <div className="flex items-start gap-2.5 animate-fade-in-up">
      <RobotAvatar />
      <div className="rounded-2xl rounded-bl-none bg-surface border border-stone-800/60 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5 h-3">
          <div className="h-1.5 w-1.5 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0s" }} />
          <div className="h-1.5 w-1.5 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0.2s" }} />
          <div className="h-1.5 w-1.5 rounded-full bg-primary-light animate-bounce-dot" style={{ animationDelay: "0.4s" }} />
        </div>
        <div className="mt-1 text-[10px] text-stone-500 font-medium tracking-wide">
          {phase === "connecting" ? "đang kết nối..." : "đang trả lời..."}
        </div>
      </div>
    </div>
  );
}
```

**Step 6: Thêm cancel button khi đang connecting (trong App.tsx JSX)**

Ở gần khu vực TypingIndicator, thêm:

```typescriptx
{streaming && streamingPhase === "connecting" && (
  <div className="flex justify-center">
    <button
      onClick={() => {
        portRef.current?.disconnect();
        setStreaming(false);
        setStreamingPhase("idle");
        portRef.current = null;
      }}
      className="text-xs text-stone-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg border border-stone-800/50 hover:border-red-900/30 hover:bg-red-950/10"
    >
      Hủy yêu cầu
    </button>
  </div>
)}
```

**Step 7: Thêm `SETTINGS_UPDATED` message khi save settings**

Trong `updateSettings`:

```typescript
async function updateSettings(next: Settings) {
  setSettings(next);
  await saveSettings(next);
  // Báo cho background worker biết settings đã thay đổi
  chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" }).catch(() => undefined);
}
```

**Step 8: Thêm `SETTINGS_UPDATED` type vào `ExtensionMessage`**

```typescript
export type ExtensionMessage =
  // ... existing
  | { type: "SETTINGS_UPDATED" };
```

**Step 9: Type check**

```bash
npm run compile
```
Expected: No errors.

---

### Task D: Build & test

**Objective:** Verify tất cả thay đổi hoạt động.

**Step 1: Type check**

```bash
npm run compile
```
Expected: No errors.

**Step 2: Run tests**

```bash
npm test
```
Expected: All tests pass. Kiểm tra output — nếu test nào fail do mock thiếu callback mới, sửa mock.

**Step 3: Check test mocks**

Mở `tests/setup.ts` — kiểm tra mock cho `chrome.runtime.connect` và port. Nếu test mock `streamChatCompletion`, cần đảm bảo mock không bị ảnh hưởng bởi optional callbacks mới.

**Step 4: Build**

```bash
npm run build
```
Expected: Build thành công trong `.output/chrome-mv3/`.

**Step 5: Manual verify UI**

1. Load unpacked extension từ `.output/chrome-mv3/` trong `chrome://extensions` (Developer mode)
2. Mở side panel
3. Gửi tin nhắn ngắn — observe:
   - "đang kết nối..." (rất nhanh, có thể không thấy nếu provider nhanh)
   - → "đang trả lời..."
   - Response xuất hiện
4. Test cancel button — gửi tin nhắn, click "Hủy yêu cầu" ngay
5. Test watchdog — dùng provider chậm hoặc sai URL → sau 15s thấy lỗi

---

## Tóm tắt tasks (restructured)

| Task | Files | Nội dung | Depends on | Ước lượng |
|------|-------|----------|------------|-----------|
| **A** | `client.ts`, `stream.ts` | Callbacks (optional), TTFT watchdog, signal cleanup, REQUEST_TIMEOUT giảm | — | ~50 dòng code |
| **B** | `types.ts`, `background.ts` | Message types, forward callbacks, cache settings | Task A | ~30 dòng code |
| **C** | `App.tsx`, `ChatMessage.tsx`, `types.ts` | Phase state, port ref, cancel button, TypingIndicator update | Task B | ~40 dòng code |
| **D** | — | Typecheck, test, build, manual verify | Task C | — |

## Risks & Tradeoffs

- **TTFT watchdog 15s**: Provider thường xuyên >15s cho first token → user thấy lỗi giả. Có thể configurable sau. Message lỗi rõ ràng: "Provider is too slow. No response after 15 seconds." hướng dẫn user đổi provider.
- **Cache settings 5s**: Chỉ cache cho `AI_CHAT_REQUEST`. `LOAD_MODELS` và `TEST_CONNECTION` luôn fetch mới. `SETTINGS_UPDATED` message invalidates cache ngay khi user lưu settings → không có window rủi ro.
- **`portRef.current`**: Cần cleanup ở `onDisconnect` và `onDone`/`onError` để tránh memory leak.
- **`combineAbortSignals` → `createCombinedAbortSignal`**: Internal API change, chỉ dùng trong `client.ts`. `search_files` confirm không còn reference.
- **Chrome compatibility**: Extension target Chrome MV3 (>= Chrome 100). `AbortController` và `AbortSignal` fully supported. `AbortSignal.any()` (Chrome 116+) không dùng để giữ compatibility rộng.
