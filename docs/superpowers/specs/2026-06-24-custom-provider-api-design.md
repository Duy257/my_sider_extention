# Custom Provider API Design

## Status

Approved for spec creation on 2026-06-24.

## Motivation

The extension currently supports only OpenAI via hardcoded `https://api.openai.com/v1/responses` endpoint. The user wants to use alternative providers (e.g. opencode API, LiteLLM proxy, any OpenAI-compatible endpoint) without modifying extension code.

## Design Approach

**Approach 1 — Keep OpenAI as default, add Custom provider option.**

- Dropdown in Settings to choose: "OpenAI" or "Custom"
- OpenAI mode preserves existing UI (API key + model presets + custom model input)
- Custom mode shows: Base URL, API Key, Model name (free text)
- AI client is refactored from Responses API to Chat Completions API for broader compatibility

## Data Model

Add `custom` to `AiProvider`, add `CustomProviderConfig`:

```ts
export type AiProvider = "openai" | "custom";

export type CustomProviderConfig = {
  baseUrl: string;      // full URL including /v1/chat/completions
  apiKey?: string;
  model: string;        // model name string
};

export type Settings = {
  provider: AiProvider;
  openaiApiKey?: string;
  modelPreset?: string;
  customModel?: string;
  customProvider?: CustomProviderConfig;
  defaultLanguage: "vi" | "en";
  updatedAt: string;
};
```

When `provider: "openai"`, `customProvider` is undefined. When `provider: "custom"`, the OpenAI-specific fields are ignored.

## AI Client

**File: `src/lib/ai/client.ts`** (replaces `openai.ts`)

Generic Chat Completions streaming client:

```ts
export async function streamChatCompletion(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AiMessage[];
  signal?: AbortSignal;
  callbacks: {
    onDelta: (delta: string) => void;
    onDone: () => void;
    onError: (message: string) => void;
  };
}): Promise<void>
```

- POST to `baseUrl` with Chat Completions request body (`model`, `messages`, `stream: true`)
- Parse SSE data lines: `data: {...}` lines, stop at `data: [DONE]`
- Map errors (network, HTTP status, stream errors)
- Updated `mapOpenAIError` → `mapStreamError` (generic naming)
- Remove `extractResponseTextDelta` (no longer needed — Chat Completions delta is at `choices[0].delta.content`)
- Update `AiStreamEvent` type if needed to match Chat Completions SSE structure

## Models

- `OPENAI_MODEL_PRESETS` and `DEFAULT_OPENAI_MODEL` remain for OpenAI mode only
- Custom provider has no presets — user types model name directly
- `resolveSelectedModel` logic unchanged

## Background Worker

**`entrypoints/background.ts`**

On `AI_CHAT_REQUEST`:

1. Read settings from storage
2. Determine parameters based on `provider`:
   - **openai**: `baseUrl = "https://api.openai.com/v1/chat/completions"`, `apiKey = settings.openaiApiKey`, `model = resolveSelectedModel(settings.modelPreset, settings.customModel)`
   - **custom**: `baseUrl = settings.customProvider.baseUrl`, `apiKey = settings.customProvider.apiKey`, `model = settings.customProvider.model`
3. Call `streamChatCompletion` with determined parameters
4. Error messages from custom provider are passed through to the UI as-is

**Host permissions**: add `<all_urls>` to allow requests to any custom provider URL.

## Settings Panel UI

**`SettingsPanel.tsx`**

Top of the panel: **Provider** dropdown (`OpenAI` | `Custom`).

**OpenAI mode** (unchanged from current):
- API key (password)
- Model preset dropdown
- Custom model text input

**Custom mode**:
- Base URL (text input, placeholder: `https://api.opencode.ai/v1/chat/completions`)
- API Key (password)
- Model name (text input, placeholder: `gpt-4o-mini`)
- **Test Connection** button

### Test Connection

When user clicks "Test Connection":
1. Send a minimal Chat Completions request to `{baseUrl}` with:
   - `model: {model}`
   - `messages: [{ role: "user", content: "Hi" }]`
   - `max_tokens: 10`
   - `stream: false`
2. Success (2xx + valid response) → show green "Connected successfully"
3. Failure → show error message from provider
4. Button disabled while testing, re-enabled after response

The test request goes through the background worker to avoid exposing API key in the content script or sidepanel directly.

## Storage & Migration

- Schema version: 1 → 2
- Migration: existing settings (provider: "openai", no customProvider) → add `customProvider: undefined`
- `createDefaultSettings` unchanged (provider: "openai")

## Error Handling

- Custom provider API key missing → "Add your API key in Settings for the custom provider"
- Custom provider connection failure → show raw error from provider
- Invalid base URL → "Could not reach the provider at {baseUrl}"
- No model name entered for custom → "Enter a model name for the custom provider"

## Files Changed

| File | Change |
|------|--------|
| `src/lib/storage/types.ts` | Add `"custom"` to `AiProvider`, add `CustomProviderConfig` type, update `Settings` |
| `src/lib/storage/defaults.ts` | No change needed |
| `src/lib/storage/migrations.ts` | Bump `CURRENT_SCHEMA_VERSION` to 2 |
| `src/lib/ai/openai.ts` | Replace with generic `client.ts` using Chat Completions |
| `src/lib/ai/stream.ts` | Update: remove `extractResponseTextDelta`, rename `mapOpenAIError` → `mapStreamError` |
| `src/lib/ai/types.ts` | Update `AiStreamEvent`/`AiStreamChunk` for Chat Completions SSE |
| `entrypoints/background.ts` | Route requests by provider, add test-connection handler |
| `entrypoints/sidepanel/components/SettingsPanel.tsx` | Provider dropdown, conditional fields, Test Connection button |
| `src/lib/messaging/types.ts` | Add `TEST_CONNECTION` message type |
| `wxt.config.ts` | Update host_permissions to `<all_urls>` |

## Non-Goals

- Anthropic/Google/etc. native providers — only OpenAI-compatible endpoints
- Multiple custom provider profiles — single custom config
- Model list fetching from custom provider
- Persistent connection health monitoring

## Testing

- Unit: `streamChatCompletion` with mock SSE responses (OpenAI format)
- Unit: Settings defaults and migration
- Unit: Provider routing logic in background
- Manual: Custom provider with opencode API
- Manual: OpenAI mode still works after migration
- Manual: Test Connection success/failure states
