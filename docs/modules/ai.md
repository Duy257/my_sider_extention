# AI Module

`src/lib/ai/`

## Mục đích

Quản lý AI providers (OpenAI, OpenCode, CommandCode, LMStudio) và thực hiện streaming chat completions. BYOK — mỗi provider có API key riêng.

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
| `streamChatCompletion(input)` | `{baseUrl, apiKey, model, messages, signal?, callbacks}` | `Promise<void>` | Stream chat completion, gọi callbacks |
| `testConnection(input)` | `{baseUrl, apiKey, model}` | `{ok}\|{ok, error}` | Test kết nối tới provider |
| `fetchModels(input)` | `{modelUrl, apiKey}` | `{models}\|{error}` | Fetch danh sách models từ provider |
| `mapStreamError(error)` | `unknown` | `string` | Map error objects sang message tiếng Việt |

## Data Flow

**Chat:**
1. UI gọi `resolveProviderRuntimeConfig(settings)` → lấy `baseUrl`, `apiKey`, `model`
2. Gọi `streamChatCompletion({ baseUrl, apiKey, model, messages, callbacks })`
3. Client fetch tới `baseUrl` với `stream: true`, parse SSE `data:` lines
4. Mỗi delta gọi `callbacks.onDelta`, hoàn tất gọi `callbacks.onDone`, lỗi gọi `callbacks.onError`

**Models loading:**
1. UI gọi `fetchModels({ modelUrl, apiKey })`
2. Fetch từ `modelUrl`, parse `response.data[].id`, sort alphabetically
3. Fallback về `knownModels` nếu API không available

## Dependencies

- `providers.json` (static provider definitions)
- `src/lib/storage/types.ts` (Settings type cho runtime config)

## Edge Cases / Lưu ý

- LMStudio không cần API key (`requires_api_key: false`)
- `streamChatCompletion` dùng `ReadableStream` + `TextDecoder` để parse SSE stream
- `mapStreamError` trả về `""` cho AbortError (để caller biết là user huỷ, không phải lỗi)
- Model list từ API được dedup bằng `new Set()` + sort
- `fetchModels` fallback về `knownModels` khi API fail (xử lý ở caller, không trong module này)
