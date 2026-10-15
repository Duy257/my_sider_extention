# Kế hoạch chuyển lớp AI sang Mastra

> **Trạng thái:** Đã chốt phương án A (2026-10-15) và đã triển khai Task 1–6 cùng phần kiểm tra tự động của Task 7. Còn lại: test thủ công trên Chrome.
> Nhánh: `feat/mastra-ai-migration`. Các bước dùng checkbox (`- [x]`).

**Mục tiêu:** Thay phần HTTP/SSE tự viết trong `src/core/ai/client.ts` bằng thư viện, để có sẵn streaming, reasoning, usage, timeout và lỗi đã chuẩn hóa, đồng thời mở đường cho agent/tool sau này.

**Kết luận ngắn:** `@mastra/core` **không chạy được** trong background service worker của Chrome MV3 (spike ở mục 2). Khuyến nghị dùng **Vercel AI SDK v7**. Đây chính là lớp model mà Mastra dùng bên dưới, chạy được trong service worker, và model instance của nó truyền thẳng vào `new Agent({ model })` của Mastra nếu sau này có server.

---

## 1. Hiện trạng `src/core/ai`

| File | Vai trò | Ghi chú |
|---|---|---|
| `client.ts` (569 dòng) | `streamChatCompletion`, `fetchCompletion`, `testConnection`, `fetchModels`, `ModelEntry` | Tự viết: fetch + timeout 20s, gộp AbortSignal, parser SSE, watchdog first-token 30s, header `x-opencode-session`, đọc reasoning/usage qua `devtools/stream.ts` |
| `runtime.ts` | `resolveProviderRuntimeConfig`, `getThinkingParams`, `getDevStreamParams`, `getProviderHeaders` | Trả về **body param thô** (`reasoning_effort`, `thinking`, `stream_options`) để merge vào request |
| `providers.ts` + `providers.json` | Registry 5 provider | Tất cả đều OpenAI-compatible Chat Completions; `base_url` là URL đầy đủ `/chat/completions` |
| `stream.ts` | `mapStreamError` | Ánh xạ lỗi sang thông báo thân thiện |
| `types.ts` | `AiMessage`, `AiStreamChunk` | `content` luôn là string |

**Nơi sử dụng:**
- `entrypoints/background.ts`: port `ai-stream` → `streamChatCompletion`; `LOAD_MODELS` → `fetchModels`; `TEST_CONNECTION` → `testConnection`
- `entrypoints/reader/components/DefinitionPopover.tsx`: `fetchCompletion`, chạy **ngay trong trang reader**, không qua background
- `src/core/messaging/types.ts`, `src/core/prompts/builders.ts`, `src/components/floating-window/*`, `src/scripts/floating-mount.ts`: chỉ dùng type `AiMessage` / `ModelEntry`
- `src/core/storage/{defaults,migrations}.ts`, `entrypoints/sidepanel/*`: chỉ dùng registry provider
- `src/core/devtools/background-trace.ts`: type `ProviderRuntimeConfig`

**Phạm vi thực tế:** mỗi lượt là **một** chat completion. Hiện chưa có tool calling, memory hay agent loop. `builders.ts` đặt system message ngay trong mảng `messages`.

**Tests liên quan:** `tests/ai/{client,runtime,providers,stream}.test.ts`, `tests/openrouter-provider.test.ts`, `tests/background-dev-trace.test.ts`, `tests/devtools/stream.test.ts`. `client.test.ts` mock `global.fetch` bằng SSE `Response`. AI SDK cũng gọi `globalThis.fetch`, nên bộ test này dùng lại được làm **regression harness**.

---

## 2. Kết quả spike (2026-10-15)

Spike nằm ngoài repo (thư mục scratchpad): bundle bằng esbuild với `platform=browser`, rồi chạy trong `vm` context **chỉ có Web API**, không có `process`, `require` hay `Buffer`, để mô phỏng service worker MV3.

| | `@mastra/core@1.77.0` (`@mastra/core/agent`) | `ai@7.0.141` + `@ai-sdk/openai-compatible@3.0.69` |
|---|---|---|
| Bundle cho browser | **72 lỗi resolve**: 26 module built-in của Node (`fs`, `fs/promises`, `path`, `crypto`, `os`, `events`, `stream`, `async_hooks`, `child_process`, `net`, `http(s)`, `dns`, `zlib`, `readline`…), đến từ `@mastra/core`, `posthog-node` và `chat` | Build sạch |
| Kích thước sau minify | ~5.5 MB (1.4 MB gzip), đây là khi đã **stub** hết built-in | ~760 KB (173 KB gzip), phần lớn là `zod` |
| Chạy trong sandbox Web-only | **Crash lúc khởi tạo module** (`TypeError: Class extends value undefined`) | Stream đúng: reasoning, text, usage, finish reason, custom header, `reasoning_effort`, `thinking` |
| `engines` | `node >= 22.13.0` | không yêu cầu |

Để so sánh: `background.js` hiện tại chỉ **26.4 KB**.

Mastra deploy lên Cloudflare Workers cũng phải bật `nodejs_compat` để có Node API. Service worker của Chrome không có cơ chế nào tương đương. Polyfill thủ công thì phải giả lập cả `async_hooks`, `child_process` và `fs`, và có thể vỡ ở mỗi bản Mastra mới (Mastra ra bản rất dày).

Các hành vi AI SDK đã kiểm chứng trong spike:
- Không có `apiKey` thì không gửi header `Authorization` (đúng như cần cho LMStudio).
- `transformRequestBody` merge được param tùy ý vào body (`reasoning_effort`, `thinking`, `stream_options`). Nhờ đó giữ nguyên được `getThinkingParams` / `getDevStreamParams`.
- `allowSystemInMessages: true` giữ system message trong mảng như hiện tại. Mặc định v7 sẽ **từ chối** system message trong `messages`.
- `delta.reasoning_content` (DeepSeek) và `delta.reasoning` (OpenRouter) đều ra part `reasoning-delta`.
- Part `finish` có `totalUsage` và `rawFinishReason`.
- Lỗi HTTP ra `APICallError`, với `.message` là `error.message` của provider và có `.statusCode`, `.responseBody`.
- Chuỗi part theo từng tình huống:
  - Thành công: `start → start-step → reasoning-* → text-* → finish-step → finish`
  - HTTP lỗi: `start → error` (không có `start-step`)
  - Người dùng hủy: `… → abort`
  - Hết `timeout.firstChunkMs`: `start → abort`
  - Lỗi mạng: `start → error(TypeError)`
- Nếu không truyền `onError`, `streamText` tự `console.error`. Cần truyền `onError: () => {}`.

---

## 3. Phương án và quyết định cần chốt

| | A. AI SDK v7 trong background (**khuyến nghị**) | B. Mastra server + `@mastra/client-js` | C. Polyfill `@mastra/core` trong SW |
|---|---|---|---|
| Giữ BYOK / không backend | ✅ | ❌ phải chạy process Node (≥ 22.13) | ✅ |
| Agent, memory, tool, workflow | Có tool loop của AI SDK (`stopWhen`) | ✅ đầy đủ | Về lý thuyết thì có |
| Bundle background | +~750 KB | Nhỏ (client-js) | +~5.5 MB |
| Rủi ro bảo trì | Thấp | Trung bình (2 codebase, phải đồng bộ API key) | **Cao** (crash lúc init, phụ thuộc nội bộ Mastra) |
| Đổi kiến trúc / tài liệu | Không | Phải sửa mục Security Notes trong AGENTS.md | Không |

**Khuyến nghị: A.** Nếu sau này cần Mastra thật (agent nhiều bước, memory), hàm `createLanguageModel()` ở Task 2 trả về `LanguageModel` của AI SDK, và object này truyền thẳng vào `new Agent({ model })` của Mastra phía server. Công sức làm A không bị bỏ đi.

Phần chi tiết dưới đây là cho phương án A. Phương án B có dàn ý ở mục 6.

---

## 4. Kế hoạch chi tiết (Phương án A)

### Ràng buộc chung
- **Giữ nguyên public API** của `client.ts`: chữ ký 4 hàm, `StreamCallbacks` và `ModelEntry`. Nhờ vậy `background.ts`, `DefinitionPopover.tsx` và `messaging/types.ts` **không phải sửa**.
- Không đổi shape của `Settings`, nên không cần migration storage và không tăng `CURRENT_SCHEMA_VERSION`.
- `runtime.ts` vẫn trả về body param thô, và chúng được merge qua `transformRequestBody`. Test của `runtime.test.ts` giữ nguyên.
- Đặt `maxRetries: 0` để giữ hành vi cũ (mặc định AI SDK retry 2 lần, làm chậm báo lỗi và có thể bị tính phí lặp).
- Thông báo lỗi giữ đúng chuỗi cũ (tiếng Anh, như hiện tại), vì UI và test đang phụ thuộc vào chúng.
- Trước mỗi commit chạy `npm run compile` và `npm test -- --run`.

### Task 1: Thêm dependency, đo kích thước

**Files:** `package.json`, `package-lock.json` (repo có cả `bun.lock`, nên xác nhận đang dùng npm hay bun rồi chỉ cập nhật lockfile tương ứng)

- [x] `npm install ai@^7 @ai-sdk/openai-compatible@^3 zod@^4` (`zod` là peer dependency)
- [x] `npm run build`, ghi lại kích thước `background.js` và chunk `reader-*.js` trước và sau
- [x] Commit: `[ai] Add Vercel AI SDK dependencies`

### Task 2: `src/core/ai/model.ts`, factory tạo LanguageModel

**Files:** tạo `src/core/ai/model.ts` và `tests/ai/model.test.ts`; sửa `client.ts` (tách logic header)

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

// providers.json lưu URL đầy đủ ".../chat/completions"; AI SDK cần base URL
export function toApiBaseUrl(chatCompletionsUrl: string): string {
  return chatCompletionsUrl.replace(/\/chat\/completions\/?$/, "");
}

export function createLanguageModel(input: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  headers?: Record<string, string>;
  sessionId?: string;
  extraBodyParams?: Record<string, unknown>;
}): LanguageModel {
  const provider = createOpenAICompatible({
    name: "custom",
    baseURL: toApiBaseUrl(input.baseUrl),
    apiKey: input.apiKey?.trim() || undefined,
    // resolveProviderHeaders = resolveRequestHeaders cũ nhưng KHÔNG thêm Authorization/Content-Type
    headers: resolveProviderHeaders(input),
    // Giữ timeout 20s cho tới khi nhận headers (fetchWithTimeout hiện có)
    fetch: (url, init) => fetchWithTimeout(String(url), { ...init, timeout: REQUEST_TIMEOUT }),
    transformRequestBody: input.extraBodyParams
      ? (body) => ({ ...body, ...input.extraBodyParams })
      : undefined,
  });
  return provider.chatModel(input.model);
}
```

- [x] Chuyển `createHeaders`, `resolveRequestHeaders`, `fetchWithTimeout` và `createCombinedAbortSignal` sang một module dùng chung (`src/core/ai/http.ts`) để cả `model.ts` lẫn `fetchModels` cùng dùng
- [x] Test `toApiBaseUrl` cho cả 5 provider trong `providers.json`
- [x] Test: không có key thì không có `Authorization`; OpenCode thì có `x-opencode-session` (lấy từ `sessionId`, hoặc tự sinh nếu là URL `opencode.ai`); `extraBodyParams` có mặt trong body
- [x] Commit: `[ai] Add AI SDK language model factory`

### Task 3: Viết lại `streamChatCompletion` bằng `streamText`

**Files:** `src/core/ai/client.ts`

```ts
const result = streamText({
  model: createLanguageModel({ ...input }),
  messages: input.messages,          // AiMessage có content string, tương thích ModelMessage
  allowSystemInMessages: true,       // builders.ts đặt system message trong mảng
  abortSignal: input.signal,
  maxRetries: 0,
  timeout: { firstChunkMs: FIRST_TOKEN_TIMEOUT },
  onError: () => {},                 // tắt console.error mặc định
});
```

Ánh xạ part sang callback:

| Part | Callback | Ghi chú |
|---|---|---|
| `start-step` | `onConnecting` | Chỉ xuất hiện khi HTTP 2xx, khớp hành vi cũ |
| `reasoning-delta` | `markFirstActivity()` rồi `onReasoningDelta(text)` | |
| `text-delta` (text khác rỗng) | `markFirstActivity()` rồi `onDelta(text)` | |
| `finish` | `onUsage(toTokenUsage(totalUsage))`, `onFinishReason(rawFinishReason ?? finishReason)` | Dùng `rawFinishReason` để trace giữ giá trị gốc (`content_filter`, …) |
| `error` | `onError(mapAiError(error))` rồi return | |
| `abort` | Nếu `input.signal?.aborted` thì return im lặng (như cũ). Ngược lại là timeout, gọi `onError("Provider is too slow. No response after 30 seconds.")` | `firstChunkMs` báo hết giờ bằng `abort`, không phải `error` |
| hết stream | `onDone()` | |

`toTokenUsage`: map `inputTokens`/`outputTokens`/`totalTokens`, chỉ giữ số nguyên ≥ 0 (giống `readTokenUsage` cũ).

- [x] Bọc mọi lời gọi callback trong `try {} catch {}` như code cũ
- [x] Chạy `npm test -- --run tests/ai/client.test.ts tests/background-dev-trace.test.ts`. Các chỗ có thể phải chỉnh test:
  - Assert `headers` dạng object chính xác: AI SDK thêm `user-agent`, và có thể đổi kiểu `Headers`/object
  - `recovers from malformed debug payload…`: AI SDK có thể phát part `error` cho chunk lỗi parse giữa stream. Nếu vậy thì **bỏ qua** lỗi parse (`JSONParseError` / `TypeValidationError`) khi đã nhận token, để giữ hành vi cũ
  - Watchdog: `firstChunkMs` tính từ lúc bắt đầu gọi, còn code cũ là 20s chờ headers rồi thêm 30s. Cân nhắc đặt `AI_REQUEST + AI_FIRST_TOKEN`, hoặc giữ 30s và sửa chuỗi lỗi
- [x] Commit: `[ai] Stream chat completions via AI SDK`

### Task 4: `fetchCompletion` và `testConnection` dùng `generateText`

**Files:** `src/core/ai/client.ts`

- [x] `fetchCompletion` dùng `generateText({ model, messages, allowSystemInMessages: true, abortSignal, maxRetries: 0 })` và trả về `{ ok: true, content: result.text }`
- [x] `testConnection` dùng `generateText({ …, prompt: "Hi", maxOutputTokens: 10 })`
- [x] Giữ đúng chuỗi lỗi cũ thông qua `mapAiError`:
  - `TypeError` → `"Could not reach the provider. Check the URL."`
  - `JSONParseError` / `TypeValidationError` → `"Provider returned a non-JSON response. Check the URL."` hoặc `"…unexpected response format."`
  - `APICallError` không có message của provider → `` `HTTP ${statusCode}.` ``; nếu `responseBody` < 200 ký tự (testConnection) thì dùng body
- [x] `fetchModels` **giữ nguyên** (AI SDK không có API liệt kê model cho OpenAI-compatible)
- [x] Commit: `[ai] Use AI SDK for non-stream completion and connection test`

### Task 5: Chuẩn hóa ánh xạ lỗi

**Files:** `src/core/ai/stream.ts`, `tests/ai/stream.test.ts`

- [x] Thêm `mapAiError(error: unknown): string`: nhận diện `APICallError.isInstance`, `JSONParseError`, `TypeValidationError`, `AbortError` / `TimeoutError`, rồi fallback về `mapStreamError`
- [x] Test từng nhánh
- [x] Commit: `[ai] Map AI SDK errors to user-facing messages`

### Task 6: Dọn dẹp và tài liệu

- [x] Xóa parser SSE, `ChatCompletionChunk` và `CompletionResponseBody` không còn dùng trong `client.ts`
- [x] `src/core/devtools/stream.ts` (`readStreamDebugEvent`) không còn được gọi, nên xóa cùng `tests/devtools/stream.test.ts`
- [x] Cập nhật `docs/modules/ai.md`, `CHANGELOG.md`, và mục Tech Stack trong `AGENTS.md`. AGENTS.md cũng đang ghi `src/lib/ai`, trong khi thực tế là `src/core/ai`
- [x] Commit: `[ai] Remove hand-written SSE parser, update docs`

### Task 7: Kiểm tra cuối
- [x] `npm run compile`, `npm test -- --run`, `npm run build`, `npm run build:firefox`
- [ ] Load unpacked `.output/chrome-mv3/` và thử bằng tay:
  - [ ] OpenAI: chat stream, bật Dev mode xem có usage
  - [ ] OpenCode: header session, thinking `low`/`high`
  - [ ] CommandCode với model DeepSeek: `thinking.type` bật/tắt, reasoning hiện trong trace
  - [ ] LMStudio: không có API key
  - [ ] OpenRouter: `delta.reasoning`
  - [ ] Hủy giữa chừng (đóng panel hoặc bấm nút hủy) thì không hiện lỗi; sai API key thì hiện đúng message của provider
  - [ ] Reader: popover giải nghĩa (`fetchCompletion`) và Settings: Test connection, tải danh sách model

---

### Kết quả triển khai
- `npm run compile` sạch; `npm test`: 35 file, 257 test pass
- Build thật: `background.js` 26.4 KB → 435 KB (114 KB gzip); chunk reader 21.8 KB → 361 KB (97 KB gzip, do `DefinitionPopover` import trực tiếp `client.ts`)
- Nạp `background.js` đã build vào sandbox chỉ có Web API + `chrome.*` giả: khởi động OK, port nhận đủ `CONNECTING → FIRST_TOKEN → REASONING → CHUNK → DONE`, trace dev mode có usage, finish reason, thinking
- Khác biệt hành vi so với code cũ:
  - Request không stream (`fetchCompletion`, `testConnection`) bỏ trường `stream`, thay vì gửi `stream: false` (mặc định của API vẫn là không stream)
  - Chunk SSE sai schema giữa stream bị bỏ **cả chunk**. Trước đây chỉ bỏ trường debug hỏng, phần `content` của chunk đó vẫn được giữ. Test đã đổi thành `skips malformed chunks and continues content streaming`
  - Tên header gửi đi là chữ thường (`authorization`, `content-type`), điều này không ảnh hưởng gì về HTTP

## 5. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| `background.js` từ 26 KB lên ~780 KB; chunk reader cũng to ra vì `DefinitionPopover` import trực tiếp `client.ts` | Extension không tải qua mạng nên chấp nhận được. Tùy chọn (ngoài phạm vi): chuyển định nghĩa từ sang message gửi background để reader không phải bundle AI SDK |
| Tên `finishReason` bị chuẩn hóa khác giá trị cũ | Dùng `rawFinishReason` |
| AI SDK ra bản thường xuyên, API v7 có thể thay đổi | Pin minor version; test hành vi qua mock `fetch` |
| Khác biệt timeout so với watchdog cũ | Đã nêu ở Task 3; có test cho cả 2 trường hợp timeout |

---

## 6. Dàn ý phương án B (nếu vẫn muốn dùng Mastra thật)

1. Tạo package `mastra-server/` (Node ≥ 22.13): `new Mastra({ agents })`, với các agent `chat`, `selection` và `definition`. Model lấy từ `createLanguageModel()` của Task 2, hoặc dạng object `{ id: "custom/<model>", url, apiKey, headers }`.
2. Extension gọi server qua `@mastra/client-js`: `client.getAgent("chat").stream(...)`, rồi ánh xạ chunk sang các message `AI_STREAM_*` hiện có ở `background.ts`.
3. Settings thêm "Mastra server URL". Quyết định API key nằm ở server hay gửi kèm theo từng request.
4. Sửa phần Security Notes và Communication Flow trong `AGENTS.md`, vì sẽ không còn "no backend server".
5. Lợi ích chỉ thật sự rõ khi cần memory hoặc thread lưu ở server, workflow nhiều bước, hay tool chạy phía server.
