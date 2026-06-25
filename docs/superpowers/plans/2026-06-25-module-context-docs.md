# Module Context Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 6 module context markdown files + 1 index for AI agents to understand the project without loading full source code.

**Architecture:** Each module in `src/lib/` gets 1 doc file at `docs/modules/<module>.md`, written in dependency order: storage → messaging → ai → extraction → prompts → selection.

**Tech Stack:** Markdown only.

## Global Constraints

- Docs location: `docs/modules/`
- Format per-file: Mục đích → Types chính → API Export → Data Flow → Dependencies → Edge Cases / Lưu ý
- Language: Vietnamese (vi) — consistent with existing UI
- No code comments or implementation details — focus on API surface and data flow
- Each file ≤ 100 lines
- Bottom-up dependency order: storage (zero deps) → messaging (zero deps) → ai → extraction → prompts → selection

---

### Task 1: Create `docs/modules/` directory + `README.md` index

**Files:**
- Create: `docs/modules/README.md`

**Interfaces:**
- Produces: Index page listing all 6 modules with their dependency relationships

- [ ] **Step 1: Create directory and write README.md**

```bash
mkdir -p docs/modules
```

Write `docs/modules/README.md`:

```markdown
# Module Context Docs

Tài liệu này giúp AI Agent nắm bắt context của từng module trong `src/lib/` mà không cần đọc toàn bộ source code.

## Dependency Graph

```
storage ──> messaging ──> ai
                   │
                   ├──> extraction
                   ├──> prompts
                   └──> selection
```

Chi tiết từng module:

| File | Module | Mô tả |
|------|--------|-------|
| [storage.md](./storage.md) | `src/lib/storage/` | StorageEnvelope, schema versioning, CRUD, migrations |
| [messaging.md](./messaging.md) | `src/lib/messaging/` | Port protocol, message contracts, request/response types |
| [ai.md](./ai.md) | `src/lib/ai/` | Provider registry, streaming client, runtime config, error mapping |
| [extraction.md](./extraction.md) | `src/lib/extraction/` | Readability.js pipeline, DOM fallback, 40k truncation |
| [prompts.md](./prompts.md) | `src/lib/prompts/` | Prompt builders (page/selection/chat), seed templates |
| [selection.md](./selection.md) | `src/lib/selection/` | Selection types, action definitions, floating toolbar lifecycle |
```

- [ ] **Step 2: Verify**

Run: `ls docs/modules/README.md`
Expected: file exists

---

### Task 2: Write `storage.md`

**Files:**
- Create: `docs/modules/storage.md`

**Interfaces:**
- Produces: Doc covering StorageEnvelope, Settings/SavedResult/PromptTemplate types, getSettings/saveSettings/getPromptTemplates/savePromptTemplates/getSavedResults/saveSavedResults, migrations, defaults

- [ ] **Step 1: Write storage.md**

Write `docs/modules/storage.md`:

```markdown
# Storage Module

`src/lib/storage/`

## Mục đích

Typed wrapper quanh `chrome.storage.local` với schema versioning, tự động migration khi storage shape thay đổi.

## Types chính

```typescript
StorageEnvelope<T> = { schemaVersion: number; data: T }
Settings = { providerId, apiKeys, selectedModels, defaultLanguage, updatedAt }
SavedResult = { id, title, sourceType, sourceUrl?, sourceTitle?, prompt?, inputExcerpt?, outputMarkdown, createdAt }
ExtensionStorage = {
  settings: StorageEnvelope<Settings>,
  promptTemplates: StorageEnvelope<PromptTemplate[]>,
  savedResults: StorageEnvelope<SavedResult[]>
}
```

## API Export

| Function | Input | Output | Mô tả |
|----------|-------|--------|-------|
| `getSettings` | — | `Promise<Settings>` | Đọc settings, tự động migrate nếu cần |
| `saveSettings` | `Settings` | `Promise<void>` | Ghi settings với schema version hiện tại |
| `getPromptTemplates` | — | `Promise<PromptTemplate[]>` | Đọc prompt templates, fallback về seeds |
| `savePromptTemplates` | `PromptTemplate[]` | `Promise<void>` | Ghi prompt templates |
| `getSavedResults` | — | `Promise<SavedResult[]>` | Đọc saved results |
| `saveSavedResults` | `SavedResult[]` | `Promise<void>` | Ghi saved results |

Migration helpers: `migrateSettingsEnvelope`, `migrateStorageEnvelope`, `migrateSettingsData`.

## Data Flow

1. UI component gọi `getSettings()` / `getPromptTemplates()` / `getSavedResults()`
2. Storage module đọc từ `chrome.storage.local`, kiểm tra `schemaVersion`
3. Nếu version mismatch → chạy migration → write-back envelope với `CURRENT_SCHEMA_VERSION`
4. Trả về `envelope.data` (unwrap)
5. Ghi: UI gọi `save*()` → wrap vào envelope → `chrome.storage.local.set()`

## Dependencies

- `chrome.storage.local` (Chrome API)
- `src/lib/ai/providers.ts` (getDefaultProviderId)
- `src/lib/prompts/seeds.ts` (createSeedPromptTemplates)

## Edge Cases / Lưu ý

- Tự động migrate từ schema 1→3, xử lý cả format cũ (`provider: "openai"`) và mới (`providerId: "openai"`)
- `getSettings` catch all errors, luôn trả về default settings không throw
- Storage key constants: `"settings"`, `"promptTemplates"`, `"savedResults"`
```

- [ ] **Step 2: Verify file exists**

Run: `ls docs/modules/storage.md`
Expected: file exists

---

### Task 3: Write `messaging.md`

**Files:**
- Create: `docs/modules/messaging.md`

**Interfaces:**
- Produces: Doc covering ExtensionMessage types, AiPortRequest/AiPortResponse, PageExtractionResponse, TestConnectionResponse, LoadModelsResponse, AI_STREAM_PORT constant

- [ ] **Step 1: Write messaging.md**

Write `docs/modules/messaging.md`:

```markdown
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

- Stream response dùng port-based communication (chrome.runtime.connect), không phải sendMessage
- Các message type xử lý content script: `EXTRACT_PAGE_CONTENT`, `CONTENT_AGENT_READY`, `SELECTION_ACTION`, `SELECTION_TOO_LONG`, `FORWARD_SELECTION_ACTION`, `ACTIVATE_ACTIVE_TAB_AGENT`
- `AI_STREAM_PORT` bị đóng sau mỗi response — mỗi user message tạo port mới
```

- [ ] **Step 2: Verify file exists**

Run: `ls docs/modules/messaging.md`
Expected: file exists

---

### Task 4: Write `ai.md`

**Files:**
- Create: `docs/modules/ai.md`

**Interfaces:**
- Produces: Doc covering AiMessage/AiStreamChunk types, ProviderDefinition, streamChatCompletion, testConnection, fetchModels, resolveProviderRuntimeConfig, mapStreamError

- [ ] **Step 1: Write ai.md**

Write `docs/modules/ai.md`:

```markdown
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
```

- [ ] **Step 2: Verify file exists**

Run: `ls docs/modules/ai.md`
Expected: file exists

---

### Task 5: Write `extraction.md`

**Files:**
- Create: `docs/modules/extraction.md`

**Interfaces:**
- Produces: Doc covering ExtractedPageContent, ExtractionMethod, extractPageContent, extractReadableText, extractDomText

- [ ] **Step 1: Write extraction.md**

Write `docs/modules/extraction.md`:

```markdown
# Extraction Module

`src/lib/extraction/`

## Mục đích

Trích xuất nội dung trang web để gửi cho AI phân tích. Dùng Readability.js trước, fallback về DOM text extraction nếu Readability không parse được.

## Types chính

```typescript
ExtractionMethod = "readability" | "dom-fallback"

ExtractedPageContent = {
  title: string
  url: string
  text: string
  method: ExtractionMethod
  warnings: string[]
}
```

## API Export

| Function | Input | Output | Mô tả |
|----------|-------|--------|-------|
| `extractPageContent(url?)` | `string` (optional) | `ExtractedPageContent` | Entry point: chạy readability, fallback, truncate 40k chars |
| `extractReadableText(document)` | `Document` | `string` | Dùng @mozilla/readability, clone DOM để không mutate |
| `extractDomText(root)` | `Document` | `string` | Quét h1-h4, p, li, td, th, blockquote, pre, code... |

## Data Flow

1. `extractPageContent()` gọi `extractReadableText(document)`
2. Readability clone document, parse article, trả về text content
3. Nếu Readability fail (empty text) → gọi `extractDomText(document)` (DOM fallback)
4. DOM fallback: clone document → remove script/style/nav/footer/aside → query selector `h1,h2,h3,h4,p,li...` → join bằng newline
5. Output bị truncate ở 40,000 characters nếu quá dài
6. Trả về `{ title, url, text, method, warnings }`

## Dependencies

- `@mozilla/readability` (npm)
- Chỉ chạy ở content script context (có `document` global)

## Edge Cases / Lưu ý

- 40k char limit: `MAX_PAGE_CONTEXT_CHARS = 40000` + warning message nếu bị truncate
- Readability fail trên single-page apps, PDF viewer, hoặc trang không có article structure
- DOM fallback skip: `script, style, nav, footer, aside, noscript, svg, canvas, header, [hidden], [aria-hidden="true"]`
- Clone document trước khi mutate để không ảnh hưởng tới DOM gốc
```

- [ ] **Step 2: Verify file exists**

Run: `ls docs/modules/extraction.md`
Expected: file exists

---

### Task 6: Write `prompts.md`

**Files:**
- Create: `docs/modules/prompts.md`

**Interfaces:**
- Produces: Doc covering PromptCategory, PromptTemplate, PagePromptInput, buildUserChatMessages, buildPagePrompt, buildSelectionPrompt, createSeedPromptTemplates

- [ ] **Step 1: Write prompts.md**

Write `docs/modules/prompts.md`:

```markdown
# Prompts Module

`src/lib/prompts/`

## Mục đích

Xây dựng prompt messages cho AI: system message cho chat, page reading prompt (góc nhìn CEO), selection action prompts (giải thích/dịch/viết lại/tóm tắt), và seed templates.

## Types chính

```typescript
PromptCategory = "general" | "ceo" | "dev" | "legal" | "sales" | "marketing" | "custom"

PromptTemplate = {
  id: string; name: string; instruction: string;
  category: PromptCategory; sortOrder: number;
  createdAt: string; updatedAt: string
}

PagePromptInput = { title: string; url: string; text: string; warnings: string[] }
```

## API Export

| Function | Input | Output | Mô tả |
|----------|-------|--------|-------|
| `buildUserChatMessages(input)` | `string` | `AiMessage[]` | Build `[{system}, {user}]` messages cho chat |
| `buildPagePrompt(input)` | `PagePromptInput` | `string` | Build prompt đọc page với CEO template |
| `buildSelectionPrompt(action, text)` | `SelectionAction`, `string` | `string` | Build prompt theo action type |
| `createSeedPromptTemplates(now)` | `string` | `PromptTemplate[]` | Tạo 5 seed templates mặc định |

## Data Flow

**Chat:** user gõ text → `buildUserChatMessages(text)` → `[{role:"system", content:"Bạn là trợ lý AI..."}, {role:"user", content:text}]` → gửi tới AI module

**Page:** user click "Read page" → extract content → `buildPagePrompt({title, url, text, warnings})` → prompt yêu cầu phân tích CEO perspective

**Selection:** user chọn action từ toolbar → `buildSelectionPrompt(action, selectedText)` → prompt theo action:
- `explain`: Giải thích rõ ràng
- `translate_vi`: Dịch sang tiếng Việt
- `rewrite_professional`: Viết lại chuyên nghiệp
- `summarize`: Tóm tắt
- `action_list`: Chuyển thành action list

## Dependencies

- `src/lib/ai/types.ts` (AiMessage type)
- `src/lib/selection/types.ts` (SelectionAction type)

## Edge Cases / Lưu ý

- System message luôn là constant: "Bạn là trợ lý AI cá nhân, chuyên giúp đọc hiểu..."
- 5 seed templates: CEO rewrite, Problem-Cause-Solution table, Operations analysis, Action plan, Senior dev review
- Seed templates có `id` prefix `"seed-"` để phân biệt với user-created templates
- UI language: Vietnamese
```

- [ ] **Step 2: Verify file exists**

Run: `ls docs/modules/prompts.md`
Expected: file exists

---

### Task 7: Write `selection.md`

**Files:**
- Create: `docs/modules/selection.md`

**Interfaces:**
- Produces: Doc covering SelectionAction, SELECTION_ACTIONS, isSelectionLengthAllowed, isSelectionTooLong, renderSelectionToolbar, renderTooLongIndicator

- [ ] **Step 1: Write selection.md**

Write `docs/modules/selection.md`:

```markdown
# Selection Module

`src/lib/selection/`

## Mục đích

Xử lý text selection trên trang web: hiển thị floating toolbar với các action (giải thích, dịch, viết lại...), validate độ dài selection, và quản lý toolbar lifecycle.

## Types chính

```typescript
SelectionAction = "explain" | "translate_vi" | "rewrite_professional" | "summarize" | "action_list"
```

## API Export

| Export | Kiểu / Chữ ký | Mô tả |
|--------|---------------|-------|
| `SELECTION_ACTIONS` | `{action, label, icon}[]` | 5 actions với label + icon tiếng Việt |
| `isSelectionLengthAllowed(text)` | `string → boolean` | Check selection 20-20,000 ký tự |
| `isSelectionTooLong(text)` | `string → boolean` | Check selection > 20,000 ký tự |
| `renderSelectionToolbar(position, onAction, onDismiss?)` | → `HTMLElement` | Render floating toolbar tại position |
| `renderTooLongIndicator(position)` | → `HTMLElement` | Render indicator "Văn bản quá dài" |

## Data Flow

1. User select text → content script detect selection → check length
2. Nếu 20-20,000 chars: `renderSelectionToolbar(position, onAction)` tại vị trí selection
3. Nếu > 20,000 chars: `renderTooLongIndicator(position)` thông báo quá dài
4. User click action → toolbar gọi `onAction(action)` → background xử lý
5. Toolbar tự huỷ khi: scroll, resize, click outside, hoặc Escape
6. CSS selector cleanup: `document.querySelectorAll('[data-personal-ai-toolbar]').forEach(el => el.remove())`

## Dependencies

- Không depend vào module internal nào khác

## Edge Cases / Lưu ý

- `MIN_SELECTION_CHARS = 20`, `MAX_SELECTION_CHARS = 20000`
- Toolbar dùng `position: fixed`, z-index `2147483647` (cao nhất)
- Toolbar có arrow nhỏ hướng xuống selection
- Mỗi button trong toolbar có hover (surface-hover), mousedown (scale 0.96), click handlers
- Entrance animation: opacity 0→1 + scale 0.95→1 + translateY 4px→0 với cubic-bezier(0.16, 1, 0.3, 1)
- Toolbar elements đều có `dataset.personalAiToolbar = "true"` để dễ cleanup
```

- [ ] **Step 2: Verify file exists**

Run: `ls docs/modules/selection.md`
Expected: file exists

---

## Self-Review

**Spec coverage:**
- docs/modules/README.md ✅ — index + dependency graph
- storage.md ✅ — all types, CRUD, migrations, defaults
- messaging.md ✅ — all message types, port protocol, flow
- ai.md ✅ — providers, streaming, config resolution, error mapping
- extraction.md ✅ — readability, fallback, truncation
- prompts.md ✅ — builders, seeds, action prompts
- selection.md ✅ — actions, toolbar, validation

**Placeholder scan:** No TBD, TODO, or vague sections.

**Type consistency:** All function signatures match actual source code. `Settings`, `SelectionAction`, `AiMessage`, `ExtractedPageContent` etc. consistent across files.

**Scope check:** Focused — 7 files, one directory, no external dependencies.
