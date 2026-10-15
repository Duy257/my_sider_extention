# AI Module

`src/core/ai/`

## Mục đích

Quản lý AI providers (OpenAI, OpenCode, CommandCode, LMStudio, OpenRouter) và thực hiện chat completions qua [Vercel AI SDK](https://ai-sdk.dev) v7 (`ai` + `@ai-sdk/openai-compatible`). BYOK — mỗi provider có API key riêng, request đi thẳng từ extension tới provider.

| File | Vai trò |
|------|---------|
| `client.ts` | `streamChatCompletion` (`streamText`), `fetchCompletion` / `testConnection` (`generateText`), `fetchModels` (fetch trực tiếp `/models`) |
| `model.ts` | `createLanguageModel()` — tạo model OpenAI-compatible từ `baseUrl`, `apiKey`, headers, `extraBodyParams` |
| `http.ts` | `fetchWithTimeout`, `resolveRequestHeaders` (header `x-opencode-session`) |
| `stream.ts` | `mapStreamError`, `classifyAiError` (phân loại lỗi AI SDK) |
| `runtime.ts` | Resolve config từ settings, thinking params, dev stream params, provider headers |
| `providers.ts` / `providers.json` | Registry provider |

## Types chính

```typescript
AiMessage = { role: "system" | "user" | "assistant"; content: string }
AiStreamChunk = { type: "chunk"; delta } | { type: "done" } | { type: "error"; message }

ProviderDefinition = {
  id: string; label: string; baseUrl: string; modelUrl: string;
  requiresApiKey: boolean; defaultModel?: string; knownModels: string[]
}

ProviderRuntimeConfig = {
  providerId, providerLabel, baseUrl, modelUrl,
  apiKey?, model, requiresApiKey, knownModels
}
ProviderRuntimeResult = { ok: true; config: ProviderRuntimeConfig } | { ok: false; error: string }
```

## API Export

| Function | Input | Output | Mô tả |
|----------|-------|--------|-------|
| `getProvider(id)` | `string` | `ProviderDefinition \| undefined` | Tra provider theo ID |
| `getDefaultProviderId()` | — | `string` | Trả về `"openai"` |
| `getProviderOptions()` | — | `{id,label}[]` | Options cho dropdown UI |
| `resolveProviderRuntimeConfig(settings)` | `Settings` | `ProviderRuntimeResult` | Resolve config từ settings, validate API key + model |
| `streamChatCompletion(input)` | `{baseUrl, apiKey?, model, messages, signal?, extraBodyParams?, headers?, sessionId?, callbacks}` | `Promise<void>` | Stream chat completion, gọi callbacks |
| `fetchCompletion(input)` | `{baseUrl, apiKey?, model, messages, signal?, extraBodyParams?, headers?, sessionId?}` | `{ok, content}\|{ok, error}` | Completion không stream (popover giải nghĩa) |
| `testConnection(input)` | `{baseUrl, apiKey?, model, extraBodyParams?, headers?, sessionId?}` | `{ok}\|{ok, error}` | Test kết nối tới provider |
| `createLanguageModel(input)` | `{baseUrl, apiKey?, model, headers?, sessionId?, extraBodyParams?}` | `LanguageModel` | Model AI SDK, dùng được cho `streamText`/`generateText` (và Mastra `Agent` nếu sau này cần) |
| `fetchModels(input)` | `{modelUrl, apiKey}` | `{models}\|{error}` | Fetch danh sách models từ provider |
| `mapStreamError(error)` | `unknown` | `string` | Map error objects sang message thân thiện |
| `classifyAiError(error)` | `unknown` | `AiErrorInfo` | Phân loại lỗi AI SDK: `http` / `network` / `invalid-json` / `invalid-format` / `other` |

## Data Flow

**Chat:**
1. UI gọi `resolveProviderRuntimeConfig(settings)` → lấy `baseUrl`, `apiKey`, `model`
2. Gọi `streamChatCompletion({ baseUrl, apiKey, model, messages, callbacks })`
3. `createLanguageModel` tạo model OpenAI-compatible (base URL = `baseUrl` bỏ `/chat/completions`), `extraBodyParams` merge vào body qua `transformRequestBody`
4. `streamText` đọc `fullStream`: `start-step` → `onConnecting`, `reasoning-delta` → `onReasoningDelta`, `text-delta` → `onDelta`, `finish` → `onUsage` + `onFinishReason` (`rawFinishReason`), `error` → `onError`, hết stream → `onDone`

**Models loading:**
1. UI gọi `fetchModels({ modelUrl, apiKey })`
2. Fetch từ `modelUrl`, parse `response.data[].id`, sort alphabetically
3. Fallback về `knownModels` nếu API không available

## Dependencies

- `providers.json` (static provider definitions)
- `src/core/storage/types.ts` (Settings type cho runtime config)
- `ai`, `@ai-sdk/openai-compatible`, `zod` (peer dependency của AI SDK)

## Edge Cases / Lưu ý

- LMStudio không cần API key (`requires_api_key: false`)
- System message nằm trong mảng `messages` → luôn truyền `allowSystemInMessages: true` (AI SDK v7 mặc định từ chối)
- `maxRetries: 0` — không retry, giữ hành vi báo lỗi ngay như trước
- Timeout: 20s tới khi có response headers (`fetchWithTimeout`), 30s tới token đầu tiên (`timeout.firstChunkMs`, part `abort` khi người dùng không hủy)
- Chunk SSE sai định dạng giữa stream (JSON hỏng, sai schema) bị bỏ qua, stream đọc tiếp; nội dung của chính chunk đó bị mất
- Header `user-agent` do AI SDK tự thêm bị bỏ trong `fetch` wrapper để request giống trước
- `@mastra/core` không dùng được trong service worker MV3 (cần Node built-ins) — xem `docs/superpowers/plans/2026-10-15-mastra-ai-migration.md`
- `mapStreamError` trả về `""` cho AbortError (để caller biết là user huỷ, không phải lỗi)
- Model list từ API được dedup bằng `new Set()` + sort
- `fetchModels` fallback về `knownModels` khi API fail (xử lý ở caller, không trong module này)
