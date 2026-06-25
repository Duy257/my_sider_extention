# Messaging Module

`src/lib/messaging/`

## Mục đích

Định nghĩa tất cả message contracts cho communication giữa sidepanel ↔ background ↔ content script. Dùng discriminated unions để type-safe routing.

## Types chính

```typescript
// Message gửi qua chrome.runtime.sendMessage (one-shot)
ExtensionMessage =
  | { type: "ACTIVATE_ACTIVE_TAB_AGENT"; requestId }
  | { type: "EXTRACT_ACTIVE_PAGE"; requestId }
  | { type: "LOAD_MODELS"; requestId }
  | { type: "SELECTION_ACTION"; requestId; action; text; url; title; prompt }
  | { type: "GET_PENDING_SELECTION_PROMPT" }
  | { type: "SELECTION_TOO_LONG"; requestId; maxLength }
  | { type: "CONTENT_AGENT_READY" }
  | { type: "EXTRACT_PAGE_CONTENT" }
  | { type: "TEST_CONNECTION"; requestId }
  | { type: "FORWARD_SELECTION_ACTION"; requestId; prompt; title }

// Message gửi qua Port (streaming bidirectional)
AiPortRequest = { type: "AI_CHAT_REQUEST"; requestId; messages: AiMessage[] }
AiPortResponse =
  | { type: "AI_STREAM_CHUNK"; requestId; delta }
  | { type: "AI_STREAM_DONE"; requestId }
  | { type: "AI_STREAM_ERROR"; requestId; message }

// Response types
PageExtractionResponse = { title; content; url } | { error }
TestConnectionResponse = { ok: true } | { ok: false; error }
LoadModelsResponse = { ok: true; models: string[] } | { ok: false; error }
```

## API Export

| Export | Giá trị / Kiểu | Mô tả |
|--------|----------------|-------|
| `AI_STREAM_PORT` | `"ai-stream"` | Port name dùng cho `chrome.runtime.connect({ name: "ai-stream" })` |

## Data Flow

**One-shot (runtime.sendMessage):**
1. Sidepanel/content script gửi `ExtensionMessage` tới background
2. Background dùng `type` field để route đến handler tương ứng
3. Background gửi response qua callback hoặc promise

**Port streaming (runtime.connect):**
1. Sidepanel tạo Port với name `"ai-stream"`
2. Gửi `AiPortRequest` qua port.postMessage
3. Background gửi nhiều `AiPortResponse` (chunk/done/error) qua port
4. Mỗi request có `requestId` riêng để phân biệt concurrent streams

## Dependencies

- `src/lib/ai/types.ts` (AiMessage type)
- `src/lib/selection/types.ts` (SelectionAction type)

## Edge Cases / Lưu ý

- Stream response dùng port-based communication (`chrome.runtime.connect`), không phải sendMessage
- Các message type xử lý content script: `EXTRACT_PAGE_CONTENT`, `CONTENT_AGENT_READY`, `SELECTION_ACTION`, `SELECTION_TOO_LONG`, `FORWARD_SELECTION_ACTION`, `ACTIVATE_ACTIVE_TAB_AGENT`
- `AI_STREAM_PORT` bị đóng sau mỗi response — mỗi user message tạo port mới
