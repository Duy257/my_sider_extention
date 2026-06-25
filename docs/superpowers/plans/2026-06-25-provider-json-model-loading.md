# Provider JSON Model Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load provider definitions from bundled JSON, auto-load provider models through the background worker, and use one provider settings flow for OpenAI, OpenCode, CommandCode, and LMStudio.

**Architecture:** Introduce a provider registry boundary in `src/lib/ai/providers.ts`, provider-keyed storage in `src/lib/storage`, and runtime resolution helpers in `src/lib/ai/runtime.ts`. The sidepanel owns user interaction, but model loading, test connection, and chat runtime resolve provider URLs and keys in the background worker from persisted settings.

**Tech Stack:** WXT + React 19 + TypeScript + Tailwind CSS + Vitest + Testing Library

## Global Constraints

- Provider definitions are bundled in `src/lib/ai/providers.json`; no user-imported JSON files.
- API keys are never stored in JSON or build-time provider definitions.
- `model_url` responses must use OpenAI-compatible `{ "data": [{ "id": "model" }] }` shape.
- Do not infer `model_url` from `base_url`.
- Manual custom provider UI is removed.
- Providers can set `requires_api_key: false`; LMStudio must use that setting.
- Storage schema version must move from 2 to 3.
- Settings must persist before sending `LOAD_MODELS` or `TEST_CONNECTION` so background reads fresh settings.

---

## File Structure

- Create `src/lib/ai/providers.json`: bundled provider registry with OpenAI, OpenCode, CommandCode, and LMStudio.
- Modify `src/lib/ai/providers.ts`: normalize JSON, expose provider helpers, keep temporary compatibility exports until Settings is rewritten.
- Create `tests/ai/providers.test.ts`: provider registry behavior tests.
- Modify `src/lib/storage/types.ts`: move Settings to provider-keyed data while temporarily keeping legacy optional fields until final cleanup.
- Modify `src/lib/storage/defaults.ts`: default to `providerId: "openai"`.
- Modify `src/lib/storage/migrations.ts`: migrate schema v2 to v3 using bundled provider IDs.
- Modify `src/lib/storage/index.ts`: use settings-specific migration for `getSettings`.
- Modify `tests/storage/storage.test.ts`: storage defaults and migration tests.
- Modify `src/lib/ai/client.ts`: add `fetchModels`, make `apiKey` optional for streaming and test connection.
- Modify `tests/ai/client.test.ts`: model loading and optional auth tests.
- Create `src/lib/ai/runtime.ts`: resolve provider, key, and model from settings.
- Create `tests/ai/runtime.test.ts`: runtime resolution tests.
- Modify `src/lib/messaging/types.ts`: add `LOAD_MODELS`, remove URL/key/model from `TEST_CONNECTION`, remove model from `AI_CHAT_REQUEST`.
- Modify `entrypoints/background.ts`: use runtime helpers for chat, model loading, and test connection.
- Modify `entrypoints/sidepanel/components/SettingsPanel.tsx`: unified provider/key/model UI.
- Modify `entrypoints/sidepanel/App.tsx`: provider-keyed missing-key/model checks, immediate settings persistence, no model routing payload.
- Modify `tests/sidepanel-app.test.tsx`: update app smoke test for new settings shape.
- Create `tests/sidepanel-settings.test.tsx`: SettingsPanel provider/model behavior tests.
- Modify `docs/install-guide.md`: document JSON providers and model auto-loading.

---

### Task 1: Provider Registry

**Files:**
- Create: `src/lib/ai/providers.json`
- Modify: `src/lib/ai/providers.ts`
- Create: `tests/ai/providers.test.ts`

**Interfaces:**
- Produces: `ProviderDefinition`, `PROVIDERS`, `normalizeProviders(raw)`, `getProvider(id)`, `getDefaultProviderId()`, `getProviderOptions()`.
- Temporary compatibility: `PROVIDER_PRESETS` and `getPreset(id)` remain until Task 6 removes current SettingsPanel usage.

- [ ] **Step 1: Write provider registry tests**

Create `tests/ai/providers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getDefaultProviderId, getProvider, getProviderOptions, normalizeProviders, PROVIDERS } from "../../src/lib/ai/providers";

describe("provider registry", () => {
  it("loads bundled provider definitions", () => {
    expect(PROVIDERS.map((provider) => provider.id)).toEqual(["openai", "opencode", "commandcode", "lmstudio"]);
    expect(getDefaultProviderId()).toBe("openai");
    expect(getProvider("lmstudio")?.requiresApiKey).toBe(false);
  });

  it("returns dropdown options", () => {
    expect(getProviderOptions()).toContainEqual({ id: "openai", label: "OpenAI" });
  });

  it("normalizes optional fields and trims model lists", () => {
    const providers = normalizeProviders([
      {
        id: " local ",
        label: " Local ",
        base_url: " http://localhost:1234/v1/chat/completions ",
        model_url: " http://localhost:1234/v1/models ",
        known_models: [" model-a ", "", "model-a", "model-b"]
      }
    ]);

    expect(providers).toEqual([
      {
        id: "local",
        label: "Local",
        baseUrl: "http://localhost:1234/v1/chat/completions",
        modelUrl: "http://localhost:1234/v1/models",
        requiresApiKey: true,
        defaultModel: undefined,
        knownModels: ["model-a", "model-b"]
      }
    ]);
  });

  it("rejects missing required fields", () => {
    expect(() => normalizeProviders([{ id: "bad", label: "Bad", base_url: "" }])).toThrow("Provider bad is missing model_url.");
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      normalizeProviders([
        { id: "dup", label: "One", base_url: "https://one/v1/chat/completions", model_url: "https://one/v1/models" },
        { id: "dup", label: "Two", base_url: "https://two/v1/chat/completions", model_url: "https://two/v1/models" }
      ])
    ).toThrow("Duplicate provider id: dup");
  });
});
```

- [ ] **Step 2: Run provider tests to verify failure**

Run: `npx vitest run tests/ai/providers.test.ts`

Expected: FAIL because `normalizeProviders`, `PROVIDERS`, `getProviderOptions`, and `getDefaultProviderId` are not implemented.

- [ ] **Step 3: Add bundled provider JSON**

Create `src/lib/ai/providers.json`:

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
  },
  {
    "id": "opencode",
    "label": "OpenCode",
    "base_url": "https://api.opencode.ai/v1/chat/completions",
    "model_url": "https://opencode.ai/zen/go/v1/models",
    "requires_api_key": true,
    "default_model": "gpt-4o-mini",
    "known_models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"]
  },
  {
    "id": "commandcode",
    "label": "CommandCode",
    "base_url": "https://api.commandcode.ai/v1/chat/completions",
    "model_url": "https://api.commandcode.ai/v1/models",
    "requires_api_key": true,
    "default_model": "command-r-plus",
    "known_models": ["command-r-plus", "command-r", "command-light"]
  },
  {
    "id": "lmstudio",
    "label": "LMStudio",
    "base_url": "http://localhost:1234/v1/chat/completions",
    "model_url": "http://localhost:1234/v1/models",
    "requires_api_key": false,
    "default_model": "",
    "known_models": []
  }
]
```

- [ ] **Step 4: Implement provider registry helpers**

Replace `src/lib/ai/providers.ts` with:

```ts
import rawProviders from "./providers.json";

type RawProvider = {
  id?: unknown;
  label?: unknown;
  base_url?: unknown;
  model_url?: unknown;
  requires_api_key?: unknown;
  default_model?: unknown;
  known_models?: unknown;
};

export type ProviderDefinition = {
  id: string;
  label: string;
  baseUrl: string;
  modelUrl: string;
  requiresApiKey: boolean;
  defaultModel?: string;
  knownModels: string[];
};

function readRequiredString(provider: RawProvider, field: "id" | "label" | "base_url" | "model_url", label: string): string {
  const value = typeof provider[field] === "string" ? provider[field].trim() : "";
  if (!value) throw new Error(`Provider ${label} is missing ${field}.`);
  return value;
}

export function normalizeProviders(raw: unknown): ProviderDefinition[] {
  if (!Array.isArray(raw)) throw new Error("Provider registry must be an array.");

  const ids = new Set<string>();
  const providers = raw.map((value) => {
    const provider = value as RawProvider;
    const id = readRequiredString(provider, "id", "<unknown>");
    if (ids.has(id)) throw new Error(`Duplicate provider id: ${id}`);
    ids.add(id);

    const label = readRequiredString(provider, "label", id);
    const baseUrl = readRequiredString(provider, "base_url", id);
    const modelUrl = readRequiredString(provider, "model_url", id);
    const defaultModel = typeof provider.default_model === "string" && provider.default_model.trim()
      ? provider.default_model.trim()
      : undefined;
    const knownModels = Array.isArray(provider.known_models)
      ? Array.from(new Set(provider.known_models
          .map((model) => (typeof model === "string" ? model.trim() : ""))
          .filter(Boolean)))
      : [];

    return {
      id,
      label,
      baseUrl,
      modelUrl,
      requiresApiKey: typeof provider.requires_api_key === "boolean" ? provider.requires_api_key : true,
      defaultModel,
      knownModels
    };
  });

  if (providers.length === 0) throw new Error("Provider registry must contain at least one provider.");
  return providers;
}

export const PROVIDERS = normalizeProviders(rawProviders);

export function getProvider(id: string): ProviderDefinition | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}

export function getDefaultProviderId(): string {
  return getProvider("openai")?.id ?? PROVIDERS[0].id;
}

export function getProviderOptions(): { id: string; label: string }[] {
  return PROVIDERS.map(({ id, label }) => ({ id, label }));
}

export type ProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  knownModels?: string[];
  modelsUrl?: string;
};

export const PROVIDER_PRESETS: ProviderPreset[] = PROVIDERS.map((provider) => ({
  id: provider.id,
  label: provider.label,
  baseUrl: provider.baseUrl,
  defaultModel: provider.defaultModel ?? "",
  knownModels: provider.knownModels,
  modelsUrl: provider.modelUrl
}));

export function getPreset(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((provider) => provider.id === id);
}
```

- [ ] **Step 5: Run provider tests**

Run: `npx vitest run tests/ai/providers.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit provider registry**

```bash
git add src/lib/ai/providers.json src/lib/ai/providers.ts tests/ai/providers.test.ts
git commit -m "feat: load providers from bundled json"
```

---

### Task 2: Provider-Keyed Settings Storage

**Files:**
- Modify: `src/lib/storage/types.ts`
- Modify: `src/lib/storage/defaults.ts`
- Modify: `src/lib/storage/migrations.ts`
- Modify: `src/lib/storage/index.ts`
- Modify: `tests/storage/storage.test.ts`

**Interfaces:**
- Consumes: `getDefaultProviderId()`, `getProvider(id)`.
- Produces: `Settings.providerId`, `Settings.apiKeys`, `Settings.selectedModels`, `migrateSettingsEnvelope(value, fallback)`.

- [ ] **Step 1: Update storage tests for v3 settings**

Replace `tests/storage/storage.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultSettings, createInitialPromptTemplates } from "../../src/lib/storage/defaults";
import { CURRENT_SCHEMA_VERSION, migrateSettingsEnvelope, migrateStorageEnvelope } from "../../src/lib/storage/migrations";

describe("storage defaults", () => {
  it("creates provider-keyed settings", () => {
    const settings = createDefaultSettings("2026-06-25T00:00:00.000Z");

    expect(settings).toEqual({
      providerId: "openai",
      apiKeys: {},
      selectedModels: {},
      defaultLanguage: "vi",
      updatedAt: "2026-06-25T00:00:00.000Z"
    });
  });

  it("seeds five prompt templates with stable sort order", () => {
    const prompts = createInitialPromptTemplates("2026-06-24T00:00:00.000Z");

    expect(prompts).toHaveLength(5);
    expect(prompts.map((prompt) => prompt.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(prompts[0].name).toBe("CEO rewrite");
    expect(prompts[4].category).toBe("dev");
  });

  it("keeps generic envelope migration for non-settings data", () => {
    const migrated = migrateStorageEnvelope({ provider: "openai" }, 1);

    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.data).toEqual({ provider: "openai" });
  });

  it("uses schema version 3", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });

  it("migrates v2 openai settings", () => {
    const migrated = migrateSettingsEnvelope({
      schemaVersion: 2,
      data: {
        provider: "openai",
        openaiApiKey: " sk-old ",
        modelPreset: "gpt-5.4-mini",
        customModel: "",
        defaultLanguage: "en",
        updatedAt: "2026-06-24T00:00:00.000Z"
      }
    }, createDefaultSettings("fallback"));

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.data).toEqual({
      providerId: "openai",
      apiKeys: { openai: "sk-old" },
      selectedModels: { openai: "gpt-5.4-mini" },
      defaultLanguage: "en",
      updatedAt: "2026-06-24T00:00:00.000Z"
    });
  });

  it("migrates matching legacy custom provider presets", () => {
    const migrated = migrateSettingsEnvelope({
      schemaVersion: 2,
      data: {
        provider: "custom",
        customProvider: {
          preset: "opencode",
          baseUrl: "https://api.opencode.ai/v1/chat/completions",
          apiKey: " sk-open ",
          model: "gpt-4o"
        },
        defaultLanguage: "vi",
        updatedAt: "2026-06-24T00:00:00.000Z"
      }
    }, createDefaultSettings("fallback"));

    expect(migrated.data.providerId).toBe("opencode");
    expect(migrated.data.apiKeys.opencode).toBe("sk-open");
    expect(migrated.data.selectedModels.opencode).toBe("gpt-4o");
  });

  it("falls back for unmatched legacy custom provider settings", () => {
    const migrated = migrateSettingsEnvelope({
      schemaVersion: 2,
      data: {
        provider: "custom",
        customProvider: { preset: "custom", baseUrl: "https://custom.test/v1/chat/completions", apiKey: "sk-custom", model: "m" },
        defaultLanguage: "vi",
        updatedAt: "2026-06-24T00:00:00.000Z"
      }
    }, createDefaultSettings("fallback"));

    expect(migrated.data.providerId).toBe("openai");
    expect(migrated.data.apiKeys).toEqual({});
    expect(migrated.data.selectedModels).toEqual({});
  });
});
```

- [ ] **Step 2: Run storage tests to verify failure**

Run: `npx vitest run tests/storage/storage.test.ts`

Expected: FAIL because settings schema is still v2 and `migrateSettingsEnvelope` does not exist.

- [ ] **Step 3: Update storage types**

Replace `src/lib/storage/types.ts` with:

```ts
import type { PromptTemplate } from "../prompts/types";

export type AiProvider = "openai" | "custom";

export type CustomProviderConfig = {
  preset?: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
};

export type Settings = {
  providerId: string;
  apiKeys: Record<string, string | undefined>;
  selectedModels: Record<string, string | undefined>;
  defaultLanguage: "vi" | "en";
  updatedAt: string;
  provider?: AiProvider;
  openaiApiKey?: string;
  modelPreset?: string;
  customModel?: string;
  customProvider?: CustomProviderConfig;
};

export type StorageEnvelope<T> = {
  schemaVersion: number;
  data: T;
};

export type SavedResult = {
  id: string;
  title: string;
  sourceType: "chat" | "page" | "selection";
  sourceUrl?: string;
  sourceTitle?: string;
  prompt?: string;
  inputExcerpt?: string;
  outputMarkdown: string;
  createdAt: string;
};

export type ExtensionStorage = {
  settings: StorageEnvelope<Settings>;
  promptTemplates: StorageEnvelope<PromptTemplate[]>;
  savedResults: StorageEnvelope<SavedResult[]>;
};
```

- [ ] **Step 4: Update default settings**

Replace `src/lib/storage/defaults.ts` with:

```ts
import { getDefaultProviderId } from "../ai/providers";
import { createSeedPromptTemplates } from "../prompts/seeds";
import type { Settings } from "./types";

export function createDefaultSettings(now = new Date().toISOString()): Settings {
  return {
    providerId: getDefaultProviderId(),
    apiKeys: {},
    selectedModels: {},
    defaultLanguage: "vi",
    updatedAt: now
  };
}

export function createInitialPromptTemplates(now = new Date().toISOString()) {
  return createSeedPromptTemplates(now);
}
```

- [ ] **Step 5: Add settings migration**

Replace `src/lib/storage/migrations.ts` with:

```ts
import { getDefaultProviderId, getProvider } from "../ai/providers";
import type { Settings, StorageEnvelope } from "./types";

export const CURRENT_SCHEMA_VERSION = 3;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function trimString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readData(value: unknown): unknown {
  const record = asRecord(value);
  return "data" in record ? record.data : value;
}

function normalizeProviderId(providerId: unknown): string {
  const candidate = trimString(providerId);
  if (candidate && getProvider(candidate)) return candidate;
  return getDefaultProviderId();
}

export function migrateSettingsData(value: unknown, fallback: Settings): Settings {
  const data = asRecord(readData(value));
  const apiKeys: Record<string, string | undefined> = {};
  const selectedModels: Record<string, string | undefined> = {};
  let providerId = normalizeProviderId(data.providerId);

  const storedApiKeys = asRecord(data.apiKeys);
  for (const [key, value] of Object.entries(storedApiKeys)) {
    const apiKey = trimString(value);
    if (apiKey && getProvider(key)) apiKeys[key] = apiKey;
  }

  const storedModels = asRecord(data.selectedModels);
  for (const [key, value] of Object.entries(storedModels)) {
    const model = trimString(value);
    if (model && getProvider(key)) selectedModels[key] = model;
  }

  if (data.provider === "openai") {
    providerId = "openai";
    const apiKey = trimString(data.openaiApiKey);
    if (apiKey) apiKeys.openai = apiKey;
    const model = trimString(data.customModel) ?? trimString(data.modelPreset);
    if (model) selectedModels.openai = model;
  }

  if (data.provider === "custom") {
    const customProvider = asRecord(data.customProvider);
    const preset = trimString(customProvider.preset);
    if (preset && getProvider(preset)) {
      providerId = preset;
      const apiKey = trimString(customProvider.apiKey);
      const model = trimString(customProvider.model);
      if (apiKey) apiKeys[preset] = apiKey;
      if (model) selectedModels[preset] = model;
    } else {
      providerId = getDefaultProviderId();
    }
  }

  return {
    providerId,
    apiKeys,
    selectedModels,
    defaultLanguage: data.defaultLanguage === "en" ? "en" : "vi",
    updatedAt: trimString(data.updatedAt) ?? fallback.updatedAt
  };
}

export function migrateSettingsEnvelope(value: unknown, fallback: Settings): StorageEnvelope<Settings> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data: migrateSettingsData(value, fallback)
  };
}

export function migrateStorageEnvelope<T>(
  value: T | StorageEnvelope<T> | undefined,
  schemaVersion = CURRENT_SCHEMA_VERSION,
  fallbackData?: T
): StorageEnvelope<T> {
  if (value !== null && typeof value === "object" && "schemaVersion" in value && "data" in value) {
    const envelope = value as StorageEnvelope<T>;
    if (envelope.schemaVersion !== schemaVersion) {
      return { schemaVersion, data: envelope.data };
    }
    return envelope;
  }

  if (value === undefined) {
    if (fallbackData === undefined) {
      throw new Error("Cannot migrate undefined storage value without fallback data.");
    }
    return { schemaVersion, data: fallbackData };
  }

  return { schemaVersion, data: value as T };
}
```

- [ ] **Step 6: Update settings storage read path**

In `src/lib/storage/index.ts`, replace the import line:

```ts
import { CURRENT_SCHEMA_VERSION, migrateStorageEnvelope } from "./migrations";
```

with:

```ts
import { CURRENT_SCHEMA_VERSION, migrateSettingsEnvelope, migrateStorageEnvelope } from "./migrations";
```

Then replace `getSettings` with:

```ts
export async function getSettings(): Promise<Settings> {
  try {
    const fallback = createDefaultSettings();
    const stored = await getLocal<StorageEnvelope<Settings> | Settings>(SETTINGS_KEY);
    const envelope = migrateSettingsEnvelope(stored, fallback);
    if (needsMigration(stored)) {
      await setLocal(SETTINGS_KEY, envelope);
    }
    return envelope.data;
  } catch (error) {
    console.error("getSettings failed:", error);
    return createDefaultSettings();
  }
}
```

- [ ] **Step 7: Run storage tests**

Run: `npx vitest run tests/storage/storage.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit storage migration**

```bash
git add src/lib/storage/types.ts src/lib/storage/defaults.ts src/lib/storage/migrations.ts src/lib/storage/index.ts tests/storage/storage.test.ts
git commit -m "feat: migrate settings to provider keyed storage"
```

---

### Task 3: AI Client Model Loading and Optional Auth

**Files:**
- Modify: `src/lib/ai/client.ts`
- Modify: `tests/ai/client.test.ts`

**Interfaces:**
- Produces: `fetchModels({ modelUrl, apiKey? })`, `streamChatCompletion({ apiKey? })`, `testConnection({ apiKey? })`.

- [ ] **Step 1: Add client tests for model loading and optional auth**

In `tests/ai/client.test.ts`, change the existing client import from:

```ts
import { streamChatCompletion } from "../../src/lib/ai/client";
```

to:

```ts
import { fetchModels, streamChatCompletion, testConnection } from "../../src/lib/ai/client";
```

Then append this code to the end of the file:

```ts
describe("fetchModels", () => {
  it("loads, deduplicates, and sorts model ids", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "z-model" }, { id: "a-model" }, { id: "a-model" }, { id: "" }] })
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(fetchModels({ modelUrl: "https://api.test/v1/models", apiKey: "sk-test" })).resolves.toEqual({ models: ["a-model", "z-model"] });
    expect(mockFetch).toHaveBeenCalledWith("https://api.test/v1/models", { headers: { Authorization: "Bearer sk-test" } });

    vi.unstubAllGlobals();
  });

  it("omits Authorization when apiKey is empty", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: "local-model" }] })
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchModels({ modelUrl: "http://localhost:1234/v1/models" });
    expect(mockFetch).toHaveBeenCalledWith("http://localhost:1234/v1/models", { headers: {} });

    vi.unstubAllGlobals();
  });

  it("returns provider error messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ error: { message: "Bad key" } }))
    }));

    await expect(fetchModels({ modelUrl: "https://api.test/v1/models", apiKey: "bad" })).resolves.toEqual({ error: "Bad key" });
    vi.unstubAllGlobals();
  });

  it("returns non-json model response errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError("bad json"))
    }));

    await expect(fetchModels({ modelUrl: "https://api.test/v1/models" })).resolves.toEqual({ error: "Provider returned a non-JSON models response." });
    vi.unstubAllGlobals();
  });
});

describe("optional auth", () => {
  it("testConnection omits Authorization when apiKey is empty", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "ok" } }] })
    });
    vi.stubGlobal("fetch", mockFetch);

    await testConnection({ baseUrl: "http://localhost:1234/v1/chat/completions", model: "local-model" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:1234/v1/chat/completions",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } })
    );

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run AI client tests to verify failure**

Run: `npx vitest run tests/ai/client.test.ts`

Expected: FAIL because `fetchModels` is missing and client auth requires a string API key.

- [ ] **Step 3: Update AI client signatures and headers**

In `src/lib/ai/client.ts`, add this helper after `type StreamCallbacks`:

```ts
function createHeaders(apiKey?: string, includeJson = false): Record<string, string> {
  const headers: Record<string, string> = includeJson ? { "Content-Type": "application/json" } : {};
  const trimmed = apiKey?.trim();
  if (trimmed) headers.Authorization = `Bearer ${trimmed}`;
  return headers;
}
```

Change both `apiKey: string;` input types in `streamChatCompletion` and `testConnection` to:

```ts
apiKey?: string;
```

In `streamChatCompletion`, replace the current `headers` object with:

```ts
headers: createHeaders(input.apiKey, true),
```

In `testConnection`, replace the current `headers` object with:

```ts
headers: createHeaders(input.apiKey, true),
```

- [ ] **Step 4: Add explicit model loader**

Append to `src/lib/ai/client.ts`:

```ts
export async function fetchModels(input: {
  modelUrl: string;
  apiKey?: string;
}): Promise<{ models: string[] } | { error: string }> {
  try {
    const response = await fetch(input.modelUrl, {
      headers: createHeaders(input.apiKey)
    });

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

    let body: any;
    try {
      body = await response.json();
    } catch {
      return { error: "Provider returned a non-JSON models response." };
    }

    const models = Array.from(new Set((body?.data ?? [])
      .map((model: { id?: unknown }) => (typeof model.id === "string" ? model.id.trim() : ""))
      .filter(Boolean)))
      .sort();

    if (models.length === 0) return { error: "No models returned by the provider." };
    return { models };
  } catch (error) {
    const msg = error instanceof TypeError
      ? "Could not reach the provider. Check the URL."
      : error instanceof Error ? error.message : "Unknown error.";
    return { error: msg };
  }
}
```

- [ ] **Step 5: Run AI client tests**

Run: `npx vitest run tests/ai/client.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit AI client changes**

```bash
git add src/lib/ai/client.ts tests/ai/client.test.ts
git commit -m "feat: load provider models with optional auth"
```

---

### Task 4: Runtime Provider Resolution

**Files:**
- Create: `src/lib/ai/runtime.ts`
- Create: `tests/ai/runtime.test.ts`

**Interfaces:**
- Consumes: `Settings`, `getProvider(id)`.
- Produces: `resolveProviderRuntimeConfig(settings)` returning `{ ok: true; config } | { ok: false; error }`.

- [ ] **Step 1: Write runtime tests**

Create `tests/ai/runtime.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveProviderRuntimeConfig } from "../../src/lib/ai/runtime";
import type { Settings } from "../../src/lib/storage/types";

function settings(overrides: Partial<Settings>): Settings {
  return {
    providerId: "openai",
    apiKeys: {},
    selectedModels: {},
    defaultLanguage: "vi",
    updatedAt: "2026-06-25T00:00:00.000Z",
    ...overrides
  };
}

describe("resolveProviderRuntimeConfig", () => {
  it("resolves selected provider key and model", () => {
    expect(resolveProviderRuntimeConfig(settings({
      providerId: "opencode",
      apiKeys: { opencode: " sk-open " },
      selectedModels: { opencode: " gpt-4o " }
    }))).toEqual({
      ok: true,
      config: expect.objectContaining({
        providerId: "opencode",
        providerLabel: "OpenCode",
        baseUrl: "https://api.opencode.ai/v1/chat/completions",
        modelUrl: "https://opencode.ai/zen/go/v1/models",
        apiKey: "sk-open",
        model: "gpt-4o",
        requiresApiKey: true
      })
    });
  });

  it("allows providers that do not require api keys", () => {
    expect(resolveProviderRuntimeConfig(settings({ providerId: "lmstudio", selectedModels: { lmstudio: "local-model" } }))).toEqual({
      ok: true,
      config: expect.objectContaining({ providerId: "lmstudio", apiKey: undefined, model: "local-model", requiresApiKey: false })
    });
  });

  it("returns missing key error for providers that require keys", () => {
    expect(resolveProviderRuntimeConfig(settings({ providerId: "openai" }))).toEqual({
      ok: false,
      error: "Add your API key for OpenAI in Settings."
    });
  });

  it("falls back to provider default model", () => {
    expect(resolveProviderRuntimeConfig(settings({ providerId: "opencode", apiKeys: { opencode: "sk" }, selectedModels: {} }))).toEqual({
      ok: true,
      config: expect.objectContaining({ model: "gpt-4o-mini" })
    });
  });

  it("returns missing model error when no selected or default model exists", () => {
    expect(resolveProviderRuntimeConfig(settings({ providerId: "lmstudio" }))).toEqual({
      ok: false,
      error: "Select a model for LMStudio in Settings."
    });
  });

  it("returns missing provider error", () => {
    expect(resolveProviderRuntimeConfig(settings({ providerId: "missing" }))).toEqual({
      ok: false,
      error: "Selected provider is not available. Choose another provider in Settings."
    });
  });
});
```

- [ ] **Step 2: Run runtime tests to verify failure**

Run: `npx vitest run tests/ai/runtime.test.ts`

Expected: FAIL because `src/lib/ai/runtime.ts` does not exist.

- [ ] **Step 3: Implement runtime resolver**

Create `src/lib/ai/runtime.ts`:

```ts
import { getProvider } from "./providers";
import type { Settings } from "../storage/types";

export type ProviderRuntimeConfig = {
  providerId: string;
  providerLabel: string;
  baseUrl: string;
  modelUrl: string;
  apiKey?: string;
  model: string;
  requiresApiKey: boolean;
  knownModels: string[];
};

export type ProviderRuntimeResult =
  | { ok: true; config: ProviderRuntimeConfig }
  | { ok: false; error: string };

export function resolveProviderRuntimeConfig(settings: Settings): ProviderRuntimeResult {
  const provider = getProvider(settings.providerId);
  if (!provider) {
    return { ok: false, error: "Selected provider is not available. Choose another provider in Settings." };
  }

  const apiKey = settings.apiKeys[provider.id]?.trim() || undefined;
  if (provider.requiresApiKey && !apiKey) {
    return { ok: false, error: `Add your API key for ${provider.label} in Settings.` };
  }

  const model = settings.selectedModels[provider.id]?.trim() || provider.defaultModel?.trim();
  if (!model) {
    return { ok: false, error: `Select a model for ${provider.label} in Settings.` };
  }

  return {
    ok: true,
    config: {
      providerId: provider.id,
      providerLabel: provider.label,
      baseUrl: provider.baseUrl,
      modelUrl: provider.modelUrl,
      apiKey,
      model,
      requiresApiKey: provider.requiresApiKey,
      knownModels: provider.knownModels
    }
  };
}
```

- [ ] **Step 4: Run runtime tests**

Run: `npx vitest run tests/ai/runtime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit runtime resolver**

```bash
git add src/lib/ai/runtime.ts tests/ai/runtime.test.ts
git commit -m "feat: resolve provider runtime config"
```

---

### Task 5: Background Model Loading and Provider Runtime

**Files:**
- Modify: `src/lib/messaging/types.ts`
- Modify: `entrypoints/background.ts`

**Interfaces:**
- Consumes: `resolveProviderRuntimeConfig(settings)`, `fetchModels`, `testConnection`, `streamChatCompletion`.
- Produces: `LOAD_MODELS` message response and background-owned `TEST_CONNECTION` resolution.

- [ ] **Step 1: Update message types**

Replace `src/lib/messaging/types.ts` with:

```ts
import type { AiMessage } from "../ai/types";
import type { SelectionAction } from "../selection/types";

export type ExtensionMessage =
  | { type: "ACTIVATE_ACTIVE_TAB_AGENT"; requestId: string }
  | { type: "EXTRACT_ACTIVE_PAGE"; requestId: string }
  | { type: "LOAD_MODELS"; requestId: string }
  | {
      type: "SELECTION_ACTION";
      requestId: string;
      action: SelectionAction;
      text: string;
      url: string;
      title: string;
      prompt: string;
    }
  | { type: "GET_PENDING_SELECTION_PROMPT" }
  | { type: "SELECTION_TOO_LONG"; requestId: string; maxLength: number }
  | { type: "CONTENT_AGENT_READY" }
  | { type: "EXTRACT_PAGE_CONTENT" }
  | { type: "TEST_CONNECTION"; requestId: string }
  | {
      type: "FORWARD_SELECTION_ACTION";
      requestId: string;
      prompt: string;
      title: string;
    };

export type AiPortRequest = {
  type: "AI_CHAT_REQUEST";
  requestId: string;
  messages: AiMessage[];
};

export type AiPortResponse =
  | { type: "AI_STREAM_CHUNK"; requestId: string; delta: string }
  | { type: "AI_STREAM_DONE"; requestId: string }
  | { type: "AI_STREAM_ERROR"; requestId: string; message: string };

export type PageExtractionResponse =
  | { title: string; content: string; url: string }
  | { error: string };

export type TestConnectionResponse =
  | { ok: true }
  | { ok: false; error: string };

export type LoadModelsResponse =
  | { ok: true; models: string[] }
  | { ok: false; error: string };
```

- [ ] **Step 2: Update background imports and remove old resolver**

In `entrypoints/background.ts`, replace the first six imports with:

```ts
import { fetchModels, streamChatCompletion, testConnection } from "../src/lib/ai/client";
import { resolveProviderRuntimeConfig } from "../src/lib/ai/runtime";
import { AI_STREAM_PORT } from "../src/lib/messaging/ports";
import type { AiPortRequest } from "../src/lib/messaging/types";
import { getSettings } from "../src/lib/storage";
```

Delete the `buildStreamConfig(settings: Settings)` function.

- [ ] **Step 3: Use runtime resolver for chat streaming**

Inside the `AI_CHAT_REQUEST` handler, replace:

```ts
const settings = await getSettings();
const config = buildStreamConfig(settings);

if ("error" in config) {
  send({ type: "AI_STREAM_ERROR", requestId: message.requestId, message: config.error });
  return;
}

await streamChatCompletion({
  baseUrl: config.baseUrl,
  apiKey: config.apiKey,
  model: config.model,
```

with:

```ts
const settings = await getSettings();
const runtime = resolveProviderRuntimeConfig(settings);

if (!runtime.ok) {
  send({ type: "AI_STREAM_ERROR", requestId: message.requestId, message: runtime.error });
  return;
}

await streamChatCompletion({
  baseUrl: runtime.config.baseUrl,
  apiKey: runtime.config.apiKey,
  model: runtime.config.model,
```

- [ ] **Step 4: Add LOAD_MODELS and new TEST_CONNECTION handlers**

In the `chrome.runtime.onMessage.addListener` block, replace the existing `TEST_CONNECTION` handler with:

```ts
if (message.type === "LOAD_MODELS") {
  getSettings()
    .then((settings) => {
      const runtime = resolveProviderRuntimeConfig(settings);
      if (!runtime.ok) return { ok: false as const, error: runtime.error };
      return fetchModels({ modelUrl: runtime.config.modelUrl, apiKey: runtime.config.apiKey });
    })
    .then(sendResponse);
  return true;
}

if (message.type === "TEST_CONNECTION") {
  getSettings()
    .then((settings) => {
      const runtime = resolveProviderRuntimeConfig(settings);
      if (!runtime.ok) return { ok: false as const, error: runtime.error };
      return testConnection({
        baseUrl: runtime.config.baseUrl,
        apiKey: runtime.config.apiKey,
        model: runtime.config.model
      });
    })
    .then(sendResponse);
  return true;
}
```

- [ ] **Step 5: Compile background and messaging changes**

Run: `npm run compile`

Expected: PASS.

- [ ] **Step 6: Commit background runtime integration**

```bash
git add src/lib/messaging/types.ts entrypoints/background.ts
git commit -m "feat: resolve provider runtime in background"
```

---

### Task 6: Unified Settings Panel

**Files:**
- Modify: `entrypoints/sidepanel/components/SettingsPanel.tsx`
- Create: `tests/sidepanel-settings.test.tsx`

**Interfaces:**
- Consumes: `getProvider`, `getProviderOptions`, `Settings`, `LoadModelsResponse`, `TestConnectionResponse`.
- Produces: unified Settings UI using `providerId`, `apiKeys`, and `selectedModels`.

- [ ] **Step 1: Add SettingsPanel tests**

Create `tests/sidepanel-settings.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "../entrypoints/sidepanel/components/SettingsPanel";
import type { Settings } from "../src/lib/storage/types";

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    providerId: "openai",
    apiKeys: {},
    selectedModels: {},
    defaultLanguage: "vi",
    updatedAt: "2026-06-25T00:00:00.000Z",
    ...overrides
  };
}

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset();
  });

  it("renders bundled providers and removes manual base url UI", () => {
    render(<SettingsPanel settings={settings()} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/Provider/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "OpenAI" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "LMStudio" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Base URL/i)).not.toBeInTheDocument();
  });

  it("stores api keys by provider", async () => {
    const onChange = vi.fn();
    render(<SettingsPanel settings={settings()} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText(/API Key/i), "sk-test");

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      apiKeys: { openai: "sk-test" }
    }));
  });

  it("loads models and selects first returned model", async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ ok: true, models: ["model-a", "model-b"] });
    const onChange = vi.fn();
    render(<SettingsPanel settings={settings({ apiKeys: { openai: "sk" } })} onChange={onChange} />);

    await waitFor(() => expect(screen.getByRole("option", { name: "model-a" })).toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ selectedModels: { openai: "model-a" } }));
  });

  it("uses known models when model loading is blocked by missing key", () => {
    render(<SettingsPanel settings={settings({ providerId: "opencode" })} onChange={vi.fn()} />);

    expect(screen.getByText(/Add your API key to load live models/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "gpt-4o-mini" })).toBeInTheDocument();
  });

  it("sends test connection without urls or keys", async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue({ ok: true });
    render(<SettingsPanel settings={settings({ apiKeys: { openai: "sk" }, selectedModels: { openai: "gpt-5.4-mini" } })} onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /Test Connection/i }));

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "TEST_CONNECTION", requestId: expect.any(String) });
    expect(await screen.findByText("Connected successfully.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run SettingsPanel tests to verify failure**

Run: `npx vitest run tests/sidepanel-settings.test.tsx`

Expected: FAIL because SettingsPanel still renders OpenAI/custom branches.

- [ ] **Step 3: Rewrite SettingsPanel around provider registry**

Replace `entrypoints/sidepanel/components/SettingsPanel.tsx` with a component that implements these exact helpers and UI behavior:

```tsx
import { useEffect, useState } from "react";
import { getProvider, getProviderOptions } from "../../../src/lib/ai/providers";
import type { LoadModelsResponse, TestConnectionResponse } from "../../../src/lib/messaging/types";
import type { Settings } from "../../../src/lib/storage/types";

export function SettingsPanel(props: {
  settings: Settings;
  onChange: (settings: Settings) => void | Promise<void>;
}) {
  const provider = getProvider(props.settings.providerId) ?? getProvider("openai");
  const providerId = provider?.id ?? "openai";
  const [testing, setTesting] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<string[]>(provider?.knownModels ?? []);
  const [modelWarning, setModelWarning] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const apiKey = props.settings.apiKeys[providerId] ?? "";
  const selectedModel = props.settings.selectedModels[providerId] ?? "";
  const requiresKey = provider?.requiresApiKey ?? true;

  function createNextSettings(patch: Partial<Settings>): Settings {
    return { ...props.settings, ...patch, updatedAt: new Date().toISOString() };
  }

  async function commit(next: Settings) {
    await props.onChange(next);
  }

  async function updateApiKey(value: string) {
    const nextKeys = { ...props.settings.apiKeys };
    if (value.trim()) nextKeys[providerId] = value;
    else delete nextKeys[providerId];
    await commit(createNextSettings({ apiKeys: nextKeys }));
  }

  async function updateSelectedModel(value: string) {
    await commit(createNextSettings({
      selectedModels: { ...props.settings.selectedModels, [providerId]: value }
    }));
  }

  async function updateProvider(value: string) {
    const nextProvider = getProvider(value);
    const nextModels = nextProvider?.knownModels ?? [];
    setModels(nextModels);
    setModelWarning(null);
    setModelError(null);
    await commit(createNextSettings({ providerId: value }));
  }

  useEffect(() => {
    let cancelled = false;
    const knownModels = provider?.knownModels ?? [];
    setModels(knownModels);
    setModelError(null);
    setModelWarning(null);

    if (!provider) return;
    if (provider.requiresApiKey && !apiKey.trim()) {
      if (knownModels.length > 0) setModelWarning("Add your API key to load live models. Showing bundled models for now.");
      return;
    }

    setLoadingModels(true);
    chrome.runtime.sendMessage({ type: "LOAD_MODELS", requestId: crypto.randomUUID() })
      .then((response: LoadModelsResponse) => {
        if (cancelled) return;
        if (response?.ok) {
          setModels(response.models);
          setModelWarning(null);
          const current = props.settings.selectedModels[provider.id];
          const nextModel = current && response.models.includes(current)
            ? current
            : provider.defaultModel && response.models.includes(provider.defaultModel)
              ? provider.defaultModel
              : response.models[0];
          if (nextModel && nextModel !== current) {
            props.onChange(createNextSettings({ selectedModels: { ...props.settings.selectedModels, [provider.id]: nextModel } }));
          }
        } else if (knownModels.length > 0) {
          setModels(knownModels);
          setModelWarning("Using bundled model list because provider model loading failed.");
        } else {
          setModels([]);
          setModelError(response?.error ?? "Failed to load models.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (knownModels.length > 0) {
          setModels(knownModels);
          setModelWarning("Using bundled model list because provider model loading failed.");
        } else {
          setModels([]);
          setModelError("Failed to load models.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });

    return () => {
      cancelled = true;
    };
  }, [providerId, apiKey]);

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      await props.onChange(props.settings);
      const response: TestConnectionResponse = await chrome.runtime.sendMessage({ type: "TEST_CONNECTION", requestId: crypto.randomUUID() });
      setTestResult(response.ok ? { ok: true, message: "Connected successfully." } : { ok: false, message: response.error });
    } catch {
      setTestResult({ ok: false, message: "Failed to send test request." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="space-y-3 p-3">
      <label className="block text-xs text-zinc-400">
        Provider
        <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50" value={providerId} onChange={(event) => updateProvider(event.target.value)}>
          {getProviderOptions().map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>

      <p className="rounded border border-amber-700 bg-amber-950 p-2 text-xs text-amber-100">
        Your API key is stored locally in Chrome extension storage for this private MVP. It is not encrypted secret storage.
      </p>

      <label className="block text-xs text-zinc-400">
        {requiresKey ? "API Key" : "API Key (optional)"}
        <input className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50" type="password" value={apiKey} onChange={(event) => updateApiKey(event.target.value)} />
      </label>

      <label className="block text-xs text-zinc-400">
        Model
        <select className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50" value={selectedModel} onChange={(event) => updateSelectedModel(event.target.value)} disabled={models.length === 0}>
          {selectedModel && !models.includes(selectedModel) ? <option value={selectedModel}>{selectedModel}</option> : null}
          {models.map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
      </label>

      {loadingModels ? <p className="text-xs text-zinc-400">Loading models...</p> : null}
      {modelWarning ? <p className="text-xs text-amber-300">{modelWarning}</p> : null}
      {modelError ? <p className="text-xs text-red-400">{modelError}</p> : null}

      <div className="space-y-2">
        <button className="w-full rounded bg-zinc-700 px-3 py-2 text-sm text-zinc-50 hover:bg-zinc-600 disabled:opacity-50" disabled={testing} onClick={handleTestConnection}>
          {testing ? "Testing..." : "Test Connection"}
        </button>
        {testResult ? <p className={`text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>{testResult.message}</p> : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run SettingsPanel tests**

Run: `npx vitest run tests/sidepanel-settings.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit SettingsPanel rewrite**

```bash
git add entrypoints/sidepanel/components/SettingsPanel.tsx tests/sidepanel-settings.test.tsx
git commit -m "feat: unify provider settings panel"
```

---

### Task 7: App Integration, Cleanup, and Docs

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx`
- Modify: `src/lib/storage/types.ts`
- Modify: `tests/sidepanel-app.test.tsx`
- Modify: `docs/install-guide.md`

**Interfaces:**
- Consumes: provider-keyed `Settings` and SettingsPanel `onChange` returning `void | Promise<void>`.
- Produces: final app state with no legacy provider branches or model payload routing.

- [ ] **Step 1: Update app smoke test**

Replace `tests/sidepanel-app.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import App from "../entrypoints/sidepanel/App";

test("renders the sidebar after settings load", async () => {
  render(<App />);

  expect(await screen.findByText(/Add your API key for OpenAI/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Update App settings persistence and missing key/model checks**

In `entrypoints/sidepanel/App.tsx`, add imports:

```ts
import { getProvider } from "../../src/lib/ai/providers";
```

Replace the `missingApiKey` memo with:

```ts
const provider = settings ? getProvider(settings.providerId) : undefined;
const selectedModel = settings && provider ? settings.selectedModels[provider.id]?.trim() || provider.defaultModel?.trim() : "";
const missingApiKey = useMemo(() => {
  if (!settings || !provider) return true;
  if (!provider.requiresApiKey) return false;
  return !settings.apiKeys[provider.id]?.trim();
}, [settings, provider]);
const missingModel = useMemo(() => {
  if (!settings || !provider) return true;
  return !selectedModel;
}, [settings, provider, selectedModel]);
```

Replace `updateSettings` with immediate persistence:

```ts
async function updateSettings(next: Settings) {
  setSettings(next);
  await saveSettings(next);
}
```

Delete `debounceRef` and its cleanup effect.

Replace the `model` calculation and `port.postMessage` payload in `sendPrompt` with:

```ts
port.postMessage({
  type: "AI_CHAT_REQUEST",
  requestId,
  messages: buildUserChatMessages(text)
});
```

Replace the missing settings banner block with:

```tsx
{missingApiKey ? (
  <section className="p-3 text-sm text-amber-100">
    {provider ? `Add your API key for ${provider.label} in Settings before sending requests.` : "Choose a provider in Settings before sending requests."}
  </section>
) : missingModel ? (
  <section className="p-3 text-sm text-amber-100">
    {provider ? `Select a model for ${provider.label} in Settings before sending requests.` : "Choose a provider in Settings before sending requests."}
  </section>
) : null}
```

Change `ChatComposer` disabled prop to:

```tsx
<ChatComposer disabled={streaming || missingApiKey || missingModel} onSend={sendPrompt} />
```

Change the pending selection effect dependency from `[settings?.openaiApiKey]` to:

```ts
}, [settings?.providerId, selectedModel]);
```

- [ ] **Step 3: Remove legacy fields from Settings type**

In `src/lib/storage/types.ts`, delete `AiProvider`, `CustomProviderConfig`, and legacy optional fields from `Settings`. The final `Settings` type must be:

```ts
export type Settings = {
  providerId: string;
  apiKeys: Record<string, string | undefined>;
  selectedModels: Record<string, string | undefined>;
  defaultLanguage: "vi" | "en";
  updatedAt: string;
};
```

- [ ] **Step 4: Remove provider compatibility exports**

In `src/lib/ai/providers.ts`, delete `ProviderPreset`, `PROVIDER_PRESETS`, and `getPreset`.

Run: `rg "PROVIDER_PRESETS|getPreset|ProviderPreset" entrypoints src tests`

Expected: no output.

Run: `npm run compile`

Expected: PASS.

- [ ] **Step 5: Update install guide**

In `docs/install-guide.md`, replace first-use steps 31-35 with:

```md
1. Nhấn icon extension trên thanh toolbar để mở side panel
2. Vào tab **Settings**
3. Chọn provider từ danh sách bundled JSON
4. Nhập API key nếu provider yêu cầu
5. Chọn model được load từ provider hoặc danh sách bundled fallback
6. Quay lại **Chat** và bắt đầu sử dụng
```

Replace the final note `Extension không có quyền <all_urls>...` with:

```md
- Provider được khai báo trong bundled JSON của extension
- Model được auto-load từ `model_url` của provider nếu API key hợp lệ hoặc provider không yêu cầu API key
- Extension có host permissions cho OpenAI, HTTPS provider, localhost và 127.0.0.1 để hỗ trợ provider tùy chỉnh được build sẵn
```

- [ ] **Step 6: Run app and full verification**

Run: `npx vitest run tests/sidepanel-app.test.tsx tests/sidepanel-settings.test.tsx`

Expected: PASS.

Run: `npm run compile`

Expected: PASS.

Run: `npm test -- --run`

Expected: PASS.

- [ ] **Step 7: Commit app cleanup and docs**

```bash
git add entrypoints/sidepanel/App.tsx src/lib/storage/types.ts src/lib/ai/providers.ts tests/sidepanel-app.test.tsx docs/install-guide.md
git commit -m "feat: integrate provider keyed settings"
```

---

## Final Verification

- [ ] Run full test suite: `npm test -- --run`
- [ ] Run TypeScript compile: `npm run compile`
- [ ] Run production build: `npm run build`
- [ ] Confirm no manual custom provider UI remains by searching: `rg "Custom Provider|Base URL|customProvider|openaiApiKey|modelPreset|customModel" entrypoints src tests`
- [ ] Confirm provider JSON contains no secrets by reading `src/lib/ai/providers.json`.
- [ ] Confirm git status is clean after final commit: `git status --short`.
