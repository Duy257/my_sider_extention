# Dev Mode — Inline Debug Traces Design

**Date:** 2026-07-10  
**Status:** Approved  
**Scope:** Chrome MV3 extension at `/Users/duynguyen/MyProject/extentions/my_sider_extention`

## 1. Problem

The extension already sends a global `thinkingMode` and a per-request override to provider APIs, but it has no developer-facing observability:

- The SSE parser in `src/lib/ai/client.ts` accepts only `choices[0].delta.content` and discards reasoning, usage, and finish information.
- The sidepanel, selection Floating Window, and Reader each consume the AI Port independently, so diagnostics would otherwise be duplicated and inconsistent.
- Extension actions already have `requestId` values but expose no correlated trace for page extraction, selection routing, or Reader handoff.
- `DefinitionPopover` bypasses the AI Port with direct `fetchCompletion`, so it cannot receive the same debug lifecycle as the other Reader AI features.

Developers need a persistent global switch that, when enabled, shows inline diagnostics at the surface where work occurs. Normal users must see no debug UI and retain the current chat/tool behavior.

## 2. Goals

1. Add a global persisted Developer Mode setting, disabled by default.
2. Display inline AI diagnostics in the Sidepanel, selection Floating Window, and Reader.
3. Display inline traces for extension operations: Read Page, selection action routing, and Reader opening/handoff.
4. Preserve the existing streaming contract and provider compatibility when diagnostics are unavailable.
5. Never persist debug history or expose API keys, prompts, selected text, or raw page content in diagnostics.

## 3. Non-goals

- Persisting, exporting, or replaying debug traces.
- Model tool/function calling.
- Forcing a provider or model to reveal hidden chain-of-thought.
- Estimating token counts when a provider does not return usage.
- A general application-wide i18n migration.

## 4. Existing Code Audit

| Area | Current state | Design consequence |
|---|---|---|
| Thinking control | `Settings.thinkingMode`, runtime mapping, Settings card, and ChatComposer override already exist. | Dev Mode observes and reports the effective mode; it does not replace the existing thinking control. |
| SSE parsing | `streamChatCompletion` parses content deltas only. | Extend its callback contract with optional debug callbacks while retaining `onDelta`. |
| AI transport | `entrypoints/background.ts` owns `AI_STREAM_PORT`; all major chat surfaces use it. | Background is the single normalizer and event source for Dev Trace. |
| Floating Window | `FloatingWindow` streams via Port after a selection action is forwarded by the background. | Attach a selection `ToolDevTrace` when the window mounts and an `AiDevTrace` below its response. |
| Reader | Summary and Q&A stream through Port; DefinitionPopover calls `fetchCompletion` directly. | Move DefinitionPopover to the Port flow so all Reader AI results receive the same trace. |
| Page extraction | `extractPageContent` returns `method`, `text`, and `warnings`. | The trace can expose extraction method, character count, and warning count without exposing content. |
| Reader handoff | Background registers a `READER_CONTENT_READY` listener without a timeout. | Add a bounded handoff timeout and always remove the listener. |
| Storage migration | `migrateSettingsData` currently assigns `thinkingMode: "off"`. | Schema v5 must validate and preserve an existing valid thinking mode while defaulting `devMode` to `false`. |

The working tree was clean at design time. The current `feat/dev-mode` branch has no diff relative to `main`; Dev Mode has not been partially implemented.

## 5. User-facing Behavior

### 5.1 Global Developer Mode

A **Developer mode** card is placed in `SettingsPanel` after the existing Thinking card.

- Control: native checkbox with an explicit Vietnamese label, `Bật Dev Mode`.
- Help copy: explain that Developer Mode displays reasoning, request parameters, token usage, and extension-operation traces for development only.
- Default: off.
- Scope: affects new operations only. A trace already rendered remains visible until its owning surface is cleared, closed, or unmounted.
- Existing global and per-request `thinkingMode` controls remain available regardless of Developer Mode.

New display strings live in `src/lib/devtools/copy.ts` as `DEV_COPY.*`; no new Dev Mode display copy is hardcoded inside UI components.

### 5.2 Shared `DebugDetails` UI

When Developer Mode is enabled, each AI result renders a compact, expandable `DebugDetails` block immediately below the output.

Collapsed summary:

```text
DEV · stream · high · 842 ms TTFT · 1.2 s · 1,024 tok
```

Expanded sections:

```text
REQUEST
provider: openai
model: gpt-5.4-mini
thinkingMode: high
params: {"reasoning_effort":"high"}

THINKING
<provider-returned reasoning; scrollable; Copy>

USAGE
input: 650     output: 374     total: 1,024
finish: stop
```

Rules:

- The Thinking section opens automatically only when a reasoning delta arrives during streaming. It stays collapsible afterwards.
- Reasoning is shown only when the provider sends a supported reasoning field. The extension does not prompt a model to disclose hidden reasoning.
- The raw reasoning viewport has a maximum height of 240px and vertical scrolling.
- Usage is `N/A — provider không gửi usage` when no valid usage payload arrives. It is never rendered as an invented `0`.
- Copy action copies only the visible reasoning text; it does not copy request metadata, credentials, or prompt data.
- Styling is terminal-like: stone borders, compact uppercase monospace labels, and the existing violet accent for active state. New UI adds no emoji, gradient, pill control, or drop shadow.

### 5.3 Shared `ToolTraceCard` UI

`ToolTraceCard` uses the same expandable, low-noise visual language and updates from `pending` to `success`, `error`, or `cancelled`.

Example:

```text
TOOL / READ_PAGE
extractor: readability
content: 18,420 chars
warnings: 0
elapsed: 46 ms
status: success
```

Tool traces contain safe metadata only:

- Page extraction: method, character count, truncation/warning count, elapsed time, status.
- Selection action: action name, selected-text length, routing status, elapsed time, status.
- Reader handoff: extraction metadata, handoff status, elapsed time, status.

They never contain the selected text, prompt, source page content, URL query secrets, or API key.

### 5.4 Placement

| Surface | Inline placement |
|---|---|
| Sidepanel chat | `DebugDetails` below each assistant message. Read Page inserts `ToolTraceCard` into the timeline before the resulting user/assistant exchange. |
| Selection Floating Window | Selection `ToolTraceCard` at the beginning of the body; `DebugDetails` below the streamed AI result. |
| Reader | `DebugDetails` below Summary, Q&A, and Definition outputs. A compact Reader-handoff `ToolTraceCard` appears below `ReaderHeader`. |

The sidepanel changes from a homogeneous message array to a discriminated `ChatTimelineItem` union (`message` or `tool-trace`). This prevents trace-specific state from being overloaded into `ChatItem` or `system` messages.

## 6. Data Model and Transport

### 6.1 Persisted Settings

```ts
export type Settings = {
  providerId: string;
  apiKeys: Record<string, string | undefined>;
  selectedModels: Record<string, string | undefined>;
  defaultLanguage: "vi" | "en";
  thinkingMode: "off" | "low" | "medium" | "high" | "max";
  devMode: boolean;
  updatedAt: string;
};
```

`CURRENT_SCHEMA_VERSION` increments from 4 to 5. Migration accepts only the existing five thinking modes; an absent or invalid value becomes `"off"`. An absent or invalid `devMode` becomes `false`.

### 6.2 Ephemeral Trace Types

`src/lib/devtools/types.ts` defines the UI-independent types below. They exist in memory for the owning request only and are not added to `SavedResult` or `chrome.storage.local`.

```ts
export type DevSurface = "sidepanel" | "floating" | "reader";
export type DevStatus = "pending" | "success" | "error" | "cancelled" | "interrupted";

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ThinkingTrace = {
  state: "pending" | "returned" | "not-returned" | "unsupported";
  content: string;
};

export type AiDevTrace = {
  requestId: string;
  surface: DevSurface;
  feature: "chat" | "selection-response" | "reader-summary" | "reader-qa" | "reader-definition";
  status: DevStatus;
  providerId: string;
  model: string;
  requestedThinkingMode: Settings["thinkingMode"];
  effectiveRequestParams: Record<string, unknown>;
  startedAt: number;
  firstTokenAt?: number;
  finishedAt?: number;
  finishReason?: string;
  thinking: ThinkingTrace;
  usage?: TokenUsage;
  error?: string;
};

export type ToolDevTrace = {
  requestId: string;
  tool: "read-page" | "selection-action" | "open-reader";
  status: DevStatus;
  startedAt: number;
  finishedAt?: number;
  metadata: Record<string, string | number | boolean>;
  error?: string;
};
```

`effectiveRequestParams` is built from an allow-list. It may include `reasoning_effort` and a safe stream-usage marker, but never arbitrary request-body fields.

`src/lib/devtools/background-trace.ts` owns pure background-facing lifecycle helpers: create initial AI/tool traces, convert normalized client callbacks into typed Port responses, and finalize a trace as success, error, cancelled, or interrupted. `entrypoints/background.ts` only wires these helpers to Chrome ports and runtime messages, keeping the event contract unit-testable without importing the WXT background entrypoint.

### 6.3 AI Port Contract

`AiPortRequest` gains an optional, caller-supplied context that labels the surface and feature. The client never sends `devMode`; background reads it from settings.

```text
AI_CHAT_REQUEST { requestId, messages, thinkingMode?, devContext? }
```

When current settings enable Developer Mode, background emits typed Port responses in this order as applicable:

```text
AI_STREAM_DEBUG_START { trace }
AI_STREAM_REASONING   { requestId, delta }
AI_STREAM_CHUNK       { requestId, delta }
AI_STREAM_DEBUG_UPDATE { requestId, usage?, finishReason? }
AI_STREAM_DONE        { requestId, trace? }
AI_STREAM_ERROR       { requestId, message, trace? }
```

When Developer Mode is off, the background emits only the current chat lifecycle (`CONNECTING`, `FIRST_TOKEN`, `CHUNK`, `DONE`, `ERROR`). Existing consumers remain compatible.

### 6.4 Stream Normalization

`streamChatCompletion` keeps `onDelta` as its required content callback and adds optional callbacks for reasoning, usage, and finish metadata.

The parser accepts only safe OpenAI-compatible values:

- `choices[0].delta.reasoning_content` and `choices[0].delta.reasoning` when they are strings.
- `usage` fields when they are non-negative finite integers.
- `choices[0].finish_reason` when it is a non-empty string.

Debug parsing never interrupts content parsing. Malformed or unknown fields are ignored.

Provider usage strategy is conservative:

- Only the `openai` provider receives `stream_options: { include_usage: true }` while Developer Mode is enabled. This provider is explicitly configured against the OpenAI Chat Completions endpoint.
- `opencode`, `commandcode`, and `lmstudio` receive no new debug-only API parameter; usage is parsed only if present in their normal stream.
- Unsupported or absent usage is represented as unavailable, not as zero.

## 7. Operation Flows

### 7.1 Sidepanel chat

1. `useChatController` sends `AI_CHAT_REQUEST` with `devContext: { surface: "sidepanel", feature: "chat" }`.
2. Background resolves settings/runtime, creates an `AiDevTrace` only if `devMode` is true, and streams normalized updates.
3. The controller updates the assistant `ChatTimelineItem` with content and its in-memory debug trace.
4. `ChatMessage` renders `DebugDetails` below the assistant output only when a trace exists.

### 7.2 Read Page

1. `App.readPage()` sends `EXTRACT_ACTIVE_PAGE` with a request ID.
2. Background starts a `read-page` `ToolDevTrace`, injects/contacts the content agent, and returns page extraction plus optional trace metadata.
3. On success, App adds a `tool-trace` item then sends the existing generated page prompt through the sidepanel AI flow.
4. On failure or empty page content, the existing user-facing error remains; the trace card changes to `error` when Dev Mode is active.

### 7.3 Selection action to Floating Window

1. `active-tab-agent.ts` sends `SELECTION_ACTION` with the existing request ID and action metadata.
2. Background creates a `selection-action` trace when Developer Mode is active, awaits forwarding to the content script, and returns an explicit `{ ok, toolTrace? }` response to the originating content script.
3. On forward success, the background includes the final safe trace in `FORWARD_SELECTION_ACTION`; `mountFloatingWindow` passes it to `FloatingWindow`, which renders it above the response. On forward failure, `active-tab-agent.ts` mounts the same Floating Window with an error trace and `skipAiRequest: true`, so an inline tool failure is visible without sending an AI request.
4. The Floating Window sends `AI_CHAT_REQUEST` with `devContext: { surface: "floating", feature: "selection-response" }` and renders `DebugDetails` under the response.

Background must not swallow the forwarding rejection. A failure produces a trace error and an error response instead of reporting unconditional success.

### 7.4 Reader opening and handoff

1. The header or popup sends `OPEN_READING_COMPANION`.
2. Background records extraction/handoff metadata, opens the Reader tab, and waits for `READER_CONTENT_READY`.
3. `LOAD_READER_CONTENT` includes an optional `ToolDevTrace`; Reader App stores it in state and renders it below `ReaderHeader`.
4. `READER_HANDOFF_TIMEOUT_MS = 10_000` bounds the wait. On timeout, background removes the listener and sends `LOAD_READER_ERROR` with the error trace to the Reader tab when it is still reachable; Reader replaces the indefinite loading state with the inline error trace. Success, failure, and timeout all remove the `readerReady` listener.

### 7.5 Reader AI features

- Summary and Q&A already use `AI_STREAM_PORT`; they add `devContext` and retain trace state by request ID.
- DefinitionPopover moves from direct `fetchCompletion` to the existing Port stream, using `reader-definition` context. The visible definition behavior stays short and incremental, but now receives the same debug trace as Summary and Q&A.

## 8. Error Handling and Privacy

| Case | Required behavior |
|---|---|
| User cancellation | Preserve partial trace as `cancelled`; do not display an AI failure caused only by user cancellation. |
| Unexpected Port disconnect | Preserve collected fields and mark trace `interrupted`. |
| Debug field malformed | Ignore the field; continue normal content streaming. |
| No reasoning or usage | Render explicit unavailable state; never guess. |
| Empty/extraction error | Show existing application error and mark its tool trace `error`. Do not send a page prompt. |
| Selection forwarding error | The originating content agent opens a non-streaming Floating Window with the error trace; no AI request is sent. |
| Reader handshake timeout | Remove the listener, send `LOAD_READER_ERROR` to the Reader when reachable, and replace its loading state with the error trace. |

Trace data is ephemeral. Saved chat results retain only the existing `outputMarkdown`; Debug Mode metadata and reasoning are never persisted in saved results or extension storage.

## 9. File Inventory

### New files

| File | Responsibility |
|---|---|
| `src/lib/devtools/types.ts` | `AiDevTrace`, `ToolDevTrace`, statuses, usage, and context types. |
| `src/lib/devtools/copy.ts` | Central Vietnamese Developer Mode display copy (`DEV_COPY`). |
| `src/lib/devtools/stream.ts` | Validate/normalize reasoning, usage, and finish metadata from parsed SSE objects. |
| `src/lib/devtools/trace-reducer.ts` | Pure trace state reducers shared by Sidepanel, Floating Window, and Reader. |
| `src/lib/devtools/background-trace.ts` | Pure background trace factories and typed Port event emitter. |
| `src/lib/devtools/components/DebugDetails.tsx` | Shared expandable AI debug renderer. |
| `src/lib/devtools/components/ToolTraceCard.tsx` | Shared expandable extension-operation trace renderer. |
| `tests/devtools/stream.test.ts` | Stream normalization and malformed-value coverage. |
| `tests/devtools/trace-reducer.test.ts` | Pure incremental trace lifecycle coverage. |
| `tests/devtools/debug-details.test.tsx` | AI debug UI interaction and unavailable states. |
| `tests/devtools/tool-trace-card.test.tsx` | Tool trace status and safe metadata rendering. |
| `tests/background-dev-trace.test.ts` | Background Port and tool-operation trace behavior. |

### Modified files

| File | Change |
|---|---|
| `src/lib/storage/types.ts` | Add persisted `devMode`. |
| `src/lib/storage/defaults.ts` | Default `devMode: false`. |
| `src/lib/storage/migrations.ts` | Increment to schema v5; preserve valid thinking mode and migrate Developer Mode safely. |
| `src/lib/ai/runtime.ts` | Carry `devMode` in runtime config and resolve safe provider-specific stream-usage params. |
| `src/lib/ai/client.ts` | Invoke optional normalized reasoning/usage/finish callbacks without changing content behavior. |
| `src/lib/messaging/types.ts` | Add typed Dev Trace context and optional debug Port/runtime-message payloads. |
| `entrypoints/background.ts` | Own trace lifecycle, safe operation trace responses, selection errors, and Reader handoff timeout cleanup. |
| `entrypoints/active-tab-agent.ts` | Receive/forward the optional selection trace to Floating Window. |
| `src/lib/floating-window/mount.ts` | Pass optional tool trace into Floating Window. |
| `src/lib/floating-window/FloatingWindow.tsx` | Maintain and render selection/AI debug traces. |
| `entrypoints/sidepanel/hooks/useChatController.ts` | Use `ChatTimelineItem`, Dev Context, and incremental trace updates. |
| `entrypoints/sidepanel/App.tsx` | Insert Read Page tool trace and pass assistant debug data to chat rendering. |
| `entrypoints/sidepanel/components/ChatMessage.tsx` | Render optional shared `DebugDetails` after assistant content. |
| `entrypoints/sidepanel/components/SettingsPanel.tsx` | Render and persist Developer Mode checkbox. |
| `entrypoints/reader/App.tsx` | Store/render Reader handoff trace. |
| `entrypoints/reader/components/SummaryTab.tsx` | Attach `reader-summary` context and render `DebugDetails`. |
| `entrypoints/reader/components/QATab.tsx` | Attach `reader-qa` context and render `DebugDetails`. |
| `entrypoints/reader/components/DefinitionPopover.tsx` | Use Port streaming with `reader-definition` context and render compact debug UI. |
| `tests/setup.ts` | Support the expanded typed Port message lifecycle when required by new tests. |
| `tests/storage/storage.test.ts` | Cover migrated Developer Mode settings. |
| `tests/ai/client.test.ts` | Cover reasoning, usage, finish metadata, and debug parse isolation. |
| `tests/ai/runtime.test.ts` | Cover runtime Developer Mode and safe usage parameter mapping. |
| `tests/use-chat-controller.test.tsx` | Cover trace-to-timeline updates and Developer Mode off compatibility. |
| `tests/sidepanel-app.test.tsx` | Cover Read Page tool trace insertion. |
| `tests/floating-window.test.tsx` | Cover selection and AI trace placement. |
| `tests/sidepanel-settings.test.tsx` | Cover Developer Mode persistence control. |

### Existing files reused without direct modification

| File | Reuse |
|---|---|
| `src/lib/extraction/index.ts` | Supplies extraction method, text length, and warnings. |
| `src/lib/prompts/builders.ts` | Continues constructing normal AI messages. |
| `src/lib/ui/MessageContent.tsx` | Continues rendering chat markdown. |
| `entrypoints/sidepanel/components/ChatComposer.tsx` | Keeps the existing per-request thinking control. |
| `src/lib/floating-window/FloatingChatMessage.tsx` | Continues rendering Floating Window response markdown. |

## 10. Testing and Verification

### Unit and component tests

1. Default settings contain `devMode: false`.
2. Schema v4 settings migrate to v5 with `devMode: false` and retain valid `thinkingMode`.
3. SSE fixtures cover content-only, reasoning-before-content, usage final chunks, finish reasons, malformed debug values, and cancellation.
4. `AI_STREAM_DEBUG_*` events are emitted only when background resolves Developer Mode as enabled.
5. Dev Trace fields are redacted to the allow-list.
6. `DebugDetails` expands, shows live reasoning, handles unavailable usage, and copies only reasoning.
7. Tool cards cover Read Page success/truncation/error, selection forward failure, and Reader timeout cleanup.
8. Each Reader feature receives an inline trace through the Port.
9. Dev Mode off has no diagnostic DOM and preserves existing message/tool behavior.

### Required commands after implementation

```sh
npm run compile
npm test
npm run build
```

No live provider or API key is required for the automated trace contract tests.
