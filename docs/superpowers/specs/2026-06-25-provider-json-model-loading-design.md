# Provider JSON Model Loading Design

## Status

Approved for spec creation on 2026-06-25.

## Motivation

The extension currently keeps provider presets in TypeScript and has separate settings flows for OpenAI and custom providers. A previous model dropdown implementation inferred the models endpoint from the chat completions URL, then needed provider-specific fixes and was later replaced by manual model entry. The new design makes provider metadata explicit in a bundled JSON file, removes manual custom provider setup, and lets users select models loaded from each provider's declared models endpoint.

## Goals

- Load all provider definitions from a bundled JSON file shipped with the extension.
- Store API keys outside the JSON file; users enter keys in Settings and keys remain in local extension storage.
- Manage OpenAI through the same provider flow as every other provider.
- Auto-load model choices from each provider's `model_url` using the OpenAI-compatible `/v1/models` response shape.
- Use bundled `known_models` as a fallback when a provider's model endpoint is unavailable.
- Remove the current manual custom provider UI.
- Support providers that do not require a bearer token, such as local OpenAI-compatible runtimes.

## Non-Goals

- User-imported provider JSON files.
- Manual custom provider creation in Settings.
- Storing real API keys in JSON or build output.
- Parsing non-OpenAI-compatible model list formats.
- Native Anthropic, Google, or other non-Chat-Completions APIs.

## Provider Registry

Add `src/lib/ai/providers.json` as the bundled registry and single source of truth for providers:

```json
[
  {
    "id": "openai",
    "label": "OpenAI",
    "base_url": "https://api.openai.com/v1/chat/completions",
    "model_url": "https://api.openai.com/v1/models",
    "requires_api_key": true,
    "default_model": "gpt-5.4-mini",
    "known_models": ["gpt-5.4-mini"]
  }
]
```

Initial registry entries include OpenAI, OpenCode, CommandCode, and LMStudio. LMStudio uses `requires_api_key: false` so local usage is not blocked by an empty key.

Provider fields:

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Stable storage key and dropdown value. |
| `label` | yes | Human-readable provider name. |
| `base_url` | yes | Full Chat Completions endpoint. |
| `model_url` | yes | Full models endpoint. |
| `requires_api_key` | no | Whether Settings must require a key. Defaults to `true`. |
| `default_model` | no | Preferred model when no saved model exists. |
| `known_models` | no | Bundled fallback list used when `model_url` fails. |

`src/lib/ai/providers.ts` imports this JSON and exports normalized provider objects plus helpers such as `getProvider(id)` and `getProviderOptions()`. Normalization is minimal and deterministic: trim string fields, default `requires_api_key` to `true`, drop empty `known_models` entries, and reject providers missing required fields. Provider IDs must be unique; duplicate IDs fail registry loading in tests and must not be silently accepted. The registry must contain at least one valid provider; tests fail if normalization produces an empty registry.

## Storage Model

Replace the split `provider`, `openaiApiKey`, `modelPreset`, `customModel`, and `customProvider` settings shape with provider-keyed state:

```ts
export type Settings = {
  providerId: string;
  apiKeys: Record<string, string | undefined>;
  selectedModels: Record<string, string | undefined>;
  defaultLanguage: "vi" | "en";
  updatedAt: string;
};
```

Default settings use `providerId: "openai"`, empty `apiKeys`, empty `selectedModels`, Vietnamese default language, and the current timestamp.

Migration from schema v2 preserves existing OpenAI data:

- `provider: "openai"` maps to `providerId: "openai"`.
- `openaiApiKey` maps to `apiKeys.openai` when present.
- `customModel` maps to `selectedModels.openai` if non-empty; otherwise `modelPreset` maps to `selectedModels.openai` if present.
- `provider: "custom"` with `customProvider.preset` matching a bundled provider ID maps to that provider ID, preserving its API key and model.
- `provider: "custom"` without a matching bundled provider preset falls back to `openai` or the first valid bundled provider. Its arbitrary `baseUrl` is not migrated because manual custom providers are no longer supported.
- If the current provider ID does not exist in the bundled JSON, fall back to `openai` when it exists; otherwise fall back to the first valid provider in registry order.

This migration bumps `CURRENT_SCHEMA_VERSION` from 2 to 3.

## Settings UI

Settings uses one provider flow for every provider:

1. A `Provider` dropdown populated from the bundled JSON registry.
2. An `API Key` password field stored as `settings.apiKeys[providerId]`; providers with `requires_api_key: false` label the field as optional.
3. A `Model` dropdown populated from the provider's loaded model list.
4. A `Test Connection` button using the selected provider and selected model.

There is no `Custom Provider`, `Base URL`, or manual model input in the UI.

When the provider changes, Settings updates `providerId`, clears stale model loading errors, persists the latest settings, and starts model loading when the selected provider has either a required API key or `requires_api_key: false`. API keys and selected models remain stored per provider, so switching providers restores each provider's previous key and model selection. Saving an empty API key removes that provider entry from `apiKeys`; runtime checks treat blank strings as missing keys if they appear in migrated or malformed data.

## Model Loading

Models auto-load through the background worker when the selected provider changes or when the selected provider has a usable API key. Providers with `requires_api_key: false` can load models without a key. The model endpoint is always the provider's explicit `model_url`; it is never inferred from `base_url`.

The sidepanel does not fetch `model_url` directly. It sends a `LOAD_MODELS` message with `requestId`, and the background worker reads current settings, resolves the selected provider, attaches the stored bearer token only when present, and returns either `{ ok: true, models }` or `{ ok: false, error }`. Before sending `LOAD_MODELS` or `TEST_CONNECTION`, Settings must persist the latest settings so the background worker does not read stale debounced values.

The supported response format is OpenAI-compatible:

```json
{
  "data": [
    { "id": "model-a" },
    { "id": "model-b" }
  ]
}
```

The loader extracts truthy string IDs, removes duplicates, sorts them, and returns an error when no models are found. On HTTP errors, it parses `error.message` from JSON responses when available, otherwise falls back to a short text body or `HTTP <status>.`. On non-JSON responses, return `Provider returned a non-JSON models response.`.

Settings handles model loading results this way:

- Successful response: show returned models in the dropdown.
- Failed response with `known_models`: show `known_models` and a small warning that bundled models are being used because provider model loading failed.
- Failed response without `known_models`: show the error and do not allow chat until a valid model can be selected.
- Saved model still present in the loaded list: keep it selected.
- Saved model missing from the loaded list: select `default_model` if present in the list; otherwise select the first loaded model.
- No API key for a provider that requires one: do not call `LOAD_MODELS`; show `known_models` when available and keep chat disabled until a key is provided.

## Chat Runtime

The background worker resolves chat configuration from the provider registry and provider-keyed settings:

1. Read settings from storage.
2. Find provider by `settings.providerId`.
3. Use provider `base_url` as the Chat Completions URL.
4. Use `settings.apiKeys[providerId]` as the bearer token when present.
5. Use `settings.selectedModels[providerId]`, falling back to provider `default_model`.
6. Call the generic Chat Completions streaming client.

`streamChatCompletion` must accept `apiKey?: string` and only add the `Authorization: Bearer <key>` header when the trimmed key is non-empty.

The sidepanel request payload does not need to send a model for routing. The background worker owns provider and model resolution from persisted settings.

## Test Connection

`TEST_CONNECTION` no longer accepts arbitrary `baseUrl`, `apiKey`, or `model` from the UI. It receives only `requestId`; the background worker reads current settings, resolves provider configuration, and calls the `testConnection` helper with the registry `base_url`, stored API key, and selected model.

`testConnection` must accept `apiKey?: string` and only add the `Authorization` header when the trimmed key is non-empty.

This keeps endpoint resolution in one trusted place and prevents the sidepanel from duplicating provider URL logic.

## Error Handling

User-facing errors are specific and actionable:

- Missing provider: `Selected provider is not available. Choose another provider in Settings.`
- Missing API key for a provider that requires one: `Add your API key for <provider label> in Settings.`
- Missing model: `Select a model for <provider label> in Settings.`
- Non-JSON model response: `Provider returned a non-JSON models response.`
- Empty model list: `No models returned by the provider.`
- Chat and test connection failures keep the current behavior: parse provider JSON error messages when available, otherwise show HTTP/text/network fallback messages.

## Files To Change

| File | Change |
| --- | --- |
| `src/lib/ai/providers.json` | Add bundled provider registry. |
| `src/lib/ai/providers.ts` | Load, normalize, and expose provider registry helpers. |
| `src/lib/ai/client.ts` | Reintroduce model loading using explicit `model_url`; keep streaming and test helpers. |
| `src/lib/storage/types.ts` | Replace split provider settings with `providerId`, `apiKeys`, and `selectedModels`. |
| `src/lib/storage/defaults.ts` | Default to bundled OpenAI provider ID. |
| `src/lib/storage/migrations.ts` | Bump schema and migrate v2 settings into provider-keyed settings. |
| `entrypoints/background.ts` | Resolve provider, key, and model from registry-backed settings. |
| `entrypoints/sidepanel/App.tsx` | Use provider-keyed missing-key/model checks and stop sending model routing data. |
| `entrypoints/sidepanel/components/SettingsPanel.tsx` | Replace OpenAI/custom branches with unified provider/key/model UI. |
| `src/lib/messaging/types.ts` | Add `LOAD_MODELS`; update `TEST_CONNECTION` and AI request types to match background-owned provider resolution. |
| `docs/install-guide.md` | Document JSON providers, local key storage, model auto-loading, and host permissions. |

## Testing

- Provider registry tests cover valid JSON normalization, default `requires_api_key`, missing required fields, duplicate IDs, empty registries, and `known_models` cleanup.
- Model loading tests cover OpenAI-compatible parsing, sorting, deduplication, HTTP errors, non-JSON responses, and empty model lists.
- Storage migration tests cover legacy OpenAI settings, matching legacy custom-provider presets, unmatched custom-provider fallback, and invalid provider IDs.
- Background config tests cover provider resolution, missing provider, missing required API key, optional no-key providers, missing model, model loading, test connection, and correct stream config for a selected provider.
- Settings UI tests cover provider dropdown rendering, provider-keyed API key persistence, auto model loading, fallback to `known_models`, and disabled chat when key/model is unavailable.
- Existing Chat Completions streaming tests continue to verify SSE parsing and error mapping.

## Success Criteria

- Adding a provider only requires editing the bundled JSON and rebuilding the extension.
- OpenAI, OpenCode, CommandCode, and localhost-compatible providers can be represented by the same JSON schema.
- Settings no longer has separate OpenAI/custom provider branches.
- Model dropdown options come from the selected provider's `model_url` when available.
- If model loading fails and `known_models` exists, the user can still select from bundled fallback models.
- No real API keys are stored in source-controlled JSON or build-time provider definitions.
