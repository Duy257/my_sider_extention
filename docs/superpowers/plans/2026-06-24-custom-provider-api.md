# Custom Provider API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to configure any OpenAI-compatible Chat Completions API as an AI provider (e.g. opencode API, LiteLLM proxy) while preserving the existing OpenAI experience.

**Architecture:** Refactor the hardcoded Responses API client into a generic Chat Completions client that accepts `baseUrl`, `apiKey`, and `model` as parameters. Add a `provider` toggle in Settings to switch between "OpenAI" (existing UX with presets) and "Custom" (free-form URL/key/model). Route AI requests in the background worker based on the selected provider.

**Tech Stack:** WXT + React + TypeScript + Tailwind + Vitest

---

### Task 1: Update Storage Types

**Files:**
- Modify: `src/lib/storage/types.ts`
- Test: `tests/storage/storage.test.ts`

- [ ] **Step 1: Add `"custom"` to `AiProvider` and add `CustomProviderConfig` type**

Edit `src/lib/storage/types.ts`:

Change `AiProvider`:

```ts
export type AiProvider = "openai" | "custom";
```

Add before `Settings`:

```ts
export type CustomProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  model: string;
};
```

Update `Settings`:

```ts
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

- [ ] **Step 2: Write failing test for custom provider in defaults**

Edit `tests/storage/storage.test.ts` — add test inside `describe("storage defaults")`:

```ts
it("creates custom provider settings with undefined customProvider by default", () => {
  const settings = createDefaultSettings("2026-06-24T00:00:00.000Z");

  expect(settings.provider).toBe("openai");
  expect(settings.customProvider).toBeUndefined();
});
```

- [ ] **Step 3: Run tests to verify**

Run: `npx vitest run tests/storage/storage.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/types.ts tests/storage/storage.test.ts
git commit -m "feat: add custom provider types to storage schema"
```

---

### Task 2: Schema Migration

**Files:**
- Modify: `src/lib/storage/migrations.ts`
- Test: `tests/storage/storage.test.ts`

- [ ] **Step 1: Bump schema version**

Edit `src/lib/storage/migrations.ts`:

```ts
export const CURRENT_SCHEMA_VERSION = 2;
```

- [ ] **Step 2: Write migration test**

Add to `tests/storage/storage.test.ts` in `describe("storage defaults")`:

```ts
it("migrates from schema v1 to v2 preserving openai settings", () => {
  const v1Data = {
    provider: "openai",
    openaiApiKey: "sk-old",
    modelPreset: "gpt-5.4-mini",
    customModel: "",
    defaultLanguage: "vi",
    updatedAt: "2026-06-24T00:00:00.000Z"
  };
  const migrated = migrateStorageEnvelope({ schemaVersion: 1, data: v1Data }, 2);

  expect(migrated.schemaVersion).toBe(2);
  expect(migrated.data).toEqual(v1Data);
});
```

- [ ] **Step 3: Run tests to verify**

Run: `npx vitest run tests/storage/storage.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage/migrations.ts tests/storage/storage.test.ts
git commit -m "feat: bump storage schema version to 2"
```

---

### Task 3: Update Stream Utilities for Chat Completions

**Files:**
- Modify: `src/lib/ai/stream.ts`
- Modify: `src/lib/ai/types.ts`
- Test: `tests/ai/stream.test.ts`

- [ ] **Step 1: Update `AiStreamEvent` type**

Edit `src/lib/ai/types.ts`:

```ts
export type AiStreamChunk =
  | { type: "chunk"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };
```

Remove `AiStreamEvent` from exports (it was Responses API specific and no longer needed).

- [ ] **Step 2: Update `stream.ts`**

Edit `src/lib/ai/stream.ts`:

```ts
import { DEFAULT_OPENAI_MODEL } from "./models";

export function resolveSelectedModel(modelPreset?: string, customModel?: string): string {
  const custom = customModel?.trim();
  if (custom) return custom;
  return modelPreset?.trim() || DEFAULT_OPENAI_MODEL;
}

export function mapStreamError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  if (error instanceof TypeError) return "Network error. Check your internet connection.";
  if (error instanceof SyntaxError) return "Received malformed data from the AI provider.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return "AI request failed. Check your API key, model, network, and quota.";
}
```

Remove `extractResponseTextDelta` and the `AiStreamEvent` import.

- [ ] **Step 3: Update stream test**

Edit `tests/ai/stream.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveSelectedModel } from "../../src/lib/ai/stream";

describe("model resolution", () => {
  it("prefers custom model when provided", () => {
    expect(resolveSelectedModel("gpt-5.4-mini", "custom-model")).toBe("custom-model");
  });

  it("uses preset model when custom model is empty", () => {
    expect(resolveSelectedModel("gpt-5.4-mini", " ")).toBe("gpt-5.4-mini");
  });

  it("falls back to default when nothing is provided", () => {
    expect(resolveSelectedModel()).toBe("gpt-5.4-mini");
  });
});

describe("mapStreamError", () => {
  it("returns empty string for AbortError", () => {
    const error = new DOMException("aborted", "AbortError");
    expect(mapStreamError(error)).toBe("");
  });

  it("returns network message for TypeError", () => {
    expect(mapStreamError(new TypeError("fetch failed"))).toBe("Network error. Check your internet connection.");
  });

  it("returns the error message for regular errors", () => {
    expect(mapStreamError(new Error("Invalid API key"))).toBe("Invalid API key");
  });
});
```

- [ ] **Step 4: Run tests to verify**

Run: `npx vitest run tests/ai/stream.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/stream.ts src/lib/ai/types.ts tests/ai/stream.test.ts
git commit -m "refactor: update stream utilities for generic Chat Completions"
```

---

### Task 4: Chat Completions Client

**Files:**
- Create: `src/lib/ai/client.ts` (replaces `openai.ts`)
- Remove: `src/lib/ai/openai.ts`
- Test: `tests/ai/client.test.ts`

- [ ] **Step 1: Write the test for Chat Completions streaming**

Create `tests/ai/client.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { streamChatCompletion } from "../../src/lib/ai/client";

function createMockSSE(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
}

describe("streamChatCompletion", () => {
  it("streams delta content from Chat Completions SSE", async () => {
    const sse = [
      'data: {"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
      'data: {"id":"2","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n"
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: createMockSSE(sse)
    });
    vi.stubGlobal("fetch", mockFetch);

    const deltas: string[] = [];
    await streamChatCompletion({
      baseUrl: "https://api.opencode.ai/v1/chat/completions",
      apiKey: "test-key",
      model: "test-model",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: {
        onDelta: (d) => deltas.push(d),
        onDone: vi.fn(),
        onError: vi.fn()
      }
    });

    expect(deltas).toEqual(["Hello", " world"]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.opencode.ai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-key"
        }),
        body: expect.stringContaining('"model":"test-model"')
      })
    );

    vi.unstubAllGlobals();
  });

  it("calls onDone after [DONE] signal", async () => {
    const sse = [
      'data: {"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
      "data: [DONE]\n\n"
    ];

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      body: createMockSSE(sse)
    }));

    const onDone = vi.fn();
    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: { onDelta: vi.fn(), onDone, onError: vi.fn() }
    });

    expect(onDone).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("calls onError on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ error: { message: "Invalid API key" } }))
    }));

    const onError = vi.fn();
    await streamChatCompletion({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: "bad-key",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: { onDelta: vi.fn(), onDone: vi.fn(), onError }
    });

    expect(onError).toHaveBeenCalledWith("Invalid API key");
    vi.unstubAllGlobals();
  });

  it("calls onError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const onError = vi.fn();
    await streamChatCompletion({
      baseUrl: "https://invalid.url/v1/chat/completions",
      apiKey: "key",
      model: "m",
      messages: [{ role: "user", content: "Hi" }],
      callbacks: { onDelta: vi.fn(), onDone: vi.fn(), onError }
    });

    expect(onError).toHaveBeenCalledWith("Network error. Check your internet connection.");
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ai/client.test.ts`
Expected: FAIL — module not found (`client.ts` doesn't exist yet)

- [ ] **Step 3: Write the Chat Completions client**

Create `src/lib/ai/client.ts`:

```ts
import { mapStreamError } from "./stream";
import type { AiMessage } from "./types";

type StreamCallbacks = {
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

export async function streamChatCompletion(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AiMessage[];
  signal?: AbortSignal;
  callbacks: StreamCallbacks;
}): Promise<void> {
  try {
    const response = await fetch(input.baseUrl, {
      method: "POST",
      signal: input.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true
      })
    });

    if (!response.ok) {
      let errorMessage = `Request failed with HTTP ${response.status}.`;
      try {
        const errorBody = await response.text();
        const parsed = JSON.parse(errorBody);
        if (parsed?.error?.message) {
          errorMessage = parsed.error.message;
        }
      } catch {}
      input.callbacks.onError(errorMessage);
      return;
    }

    if (!response.body) {
      input.callbacks.onError("No response body received from the AI provider.");
      return;
    }

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
          try { input.callbacks.onDone(); } catch {}
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            try { input.callbacks.onDelta(delta); } catch {}
          }
        } catch {}
      }
    }

    try { input.callbacks.onDone(); } catch {}
  } catch (error) {
    const mapped = mapStreamError(error);
    if (mapped) {
      try { input.callbacks.onError(mapped); } catch {}
    } else {
      try { input.callbacks.onDone(); } catch {}
    }
  }
}

export async function testConnection(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(input.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 10,
        stream: false
      })
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}.`;
      try {
        const errorBody = await response.text();
        const parsed = JSON.parse(errorBody);
        if (parsed?.error?.message) errorMessage = parsed.error.message;
      } catch {}
      return { ok: false, error: errorMessage };
    }

    const body = await response.json();
    if (!body?.choices?.[0]?.message?.content) {
      return { ok: false, error: "Provider returned an unexpected response format." };
    }

    return { ok: true };
  } catch (error) {
    const msg = error instanceof TypeError
      ? "Could not reach the provider. Check the URL."
      : error instanceof Error ? error.message : "Unknown error.";
    return { ok: false, error: msg };
  }
}
```

- [ ] **Step 4: Remove old `openai.ts`**

Run: `Remove-Item -LiteralPath "src\lib\ai\openai.ts"`

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/ai/client.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/client.ts tests/ai/client.test.ts
git rm src/lib/ai/openai.ts
git commit -m "feat: add generic Chat Completions client with test connection"
```

---

### Task 5: Update Messaging Types

**Files:**
- Modify: `src/lib/messaging/types.ts`

- [ ] **Step 1: Add `TEST_CONNECTION` message types**

Edit `src/lib/messaging/types.ts` — add to `ExtensionMessage`:

```ts
  | {
      type: "TEST_CONNECTION";
      requestId: string;
      baseUrl: string;
      apiKey: string;
      model: string;
    }
```

Add a response type export:

```ts
export type TestConnectionResponse =
  | { ok: true }
  | { ok: false; error: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/messaging/types.ts
git commit -m "feat: add TEST_CONNECTION message contract"
```

---

### Task 6: Update Background Worker

**Files:**
- Modify: `entrypoints/background.ts`
- Modify: `wxt.config.ts`

- [ ] **Step 1: Update `wxt.config.ts` host_permissions**

Edit `wxt.config.ts`:

```ts
    host_permissions: ["https://api.openai.com/*", "https://*/*"],
```

- [ ] **Step 2: Update background to route by provider**

Edit `entrypoints/background.ts`:

```ts
import { streamChatCompletion, testConnection } from "../src/lib/ai/client";
import { resolveSelectedModel } from "../src/lib/ai/stream";
import { AI_STREAM_PORT } from "../src/lib/messaging/ports";
import type { AiPortRequest } from "../src/lib/messaging/types";
import { getSettings } from "../src/lib/storage";

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab is available.");
  return tab;
}

const injectedTabs = new Set<number>();

async function injectContentAgent(tabId: number) {
  if (injectedTabs.has(tabId)) return;
  injectedTabs.add(tabId);
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["/active-tab-agent.js"]
  });
}

function buildStreamConfig(settings: import("../src/lib/storage/types").Settings) {
  if (settings.provider === "custom" && settings.customProvider) {
    const cp = settings.customProvider;
    if (!cp.apiKey?.trim()) {
      return { error: "Add your API key in Settings for the custom provider." };
    }
    if (!cp.model.trim()) {
      return { error: "Enter a model name for the custom provider." };
    }
    return {
      baseUrl: cp.baseUrl,
      apiKey: cp.apiKey.trim(),
      model: cp.model.trim()
    };
  }

  const apiKey = settings.openaiApiKey?.trim();
  if (!apiKey) {
    return { error: "Add your OpenAI API key in Settings before sending a request." };
  }
  return {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    apiKey,
    model: resolveSelectedModel(settings.modelPreset, settings.customModel)
  };
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== AI_STREAM_PORT) return;

    const controller = new AbortController();
    let busy = false;

    port.onDisconnect.addListener(() => {
      controller.abort();
    });

    port.onMessage.addListener(async (message: AiPortRequest) => {
      if (message.type !== "AI_CHAT_REQUEST") return;
      if (busy) return;
      busy = true;

      const send = (msg: Record<string, unknown>) => {
        try { port.postMessage(msg); } catch {}
      };

      try {
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
          messages: message.messages,
          signal: controller.signal,
          callbacks: {
            onDelta: (delta) =>
              send({ type: "AI_STREAM_CHUNK", requestId: message.requestId, delta }),
            onDone: () => send({ type: "AI_STREAM_DONE", requestId: message.requestId }),
            onError: (errorMessage) =>
              send({ type: "AI_STREAM_ERROR", requestId: message.requestId, message: errorMessage })
          }
        });
      } catch (error) {
        send({
          type: "AI_STREAM_ERROR",
          requestId: message.requestId,
          message: error instanceof Error ? error.message : "Unexpected streaming error."
        });
      } finally {
        busy = false;
      }
    });
  });

  const pendingSelectionPrompts: { requestId: string; prompt: string; title: string }[] = [];

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TEST_CONNECTION") {
      testConnection({
        baseUrl: message.baseUrl,
        apiKey: message.apiKey,
        model: message.model
      }).then(sendResponse);
      return true;
    }

    if (message.type === "SELECTION_ACTION") {
      pendingSelectionPrompts.push({
        requestId: message.requestId,
        prompt: message.prompt,
        title: message.title
      });
      if (sender.tab?.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id }).catch((err) =>
          console.warn("Failed to open side panel:", err)
        );
      }
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "GET_PENDING_SELECTION_PROMPT") {
      const value = pendingSelectionPrompts.shift() ?? null;
      sendResponse(value);
      return true;
    }

    if (message.type === "EXTRACT_ACTIVE_PAGE") {
      getActiveTab()
        .then(async (tab) => {
          await injectContentAgent(tab.id!);
          let lastError: unknown;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id!, { type: "EXTRACT_PAGE_CONTENT" });
              sendResponse(response);
              return;
            } catch (err) {
              lastError = err;
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
          sendResponse({ error: lastError instanceof Error ? lastError.message : "Content script not ready after retries." });
        })
        .catch((error) => sendResponse({ error: error instanceof Error ? error.message : "Page extraction failed." }));
      return true;
    }

    return false;
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add entrypoints/background.ts wxt.config.ts
git commit -m "feat: route AI requests by provider, add test-connection handler"
```

---

### Task 7: Update App.tsx Provider-Aware Checks

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx`

- [ ] **Step 1: Update `missingApiKey` check and warning text**

Edit `entrypoints/sidepanel/App.tsx` — change the `missingApiKey` useMemo:

```tsx
const missingApiKey = useMemo(() => {
  if (!settings) return true;
  if (settings.provider === "custom") {
    return !settings.customProvider?.apiKey?.trim();
  }
  return !settings.openaiApiKey?.trim();
}, [settings]);
```

Change the warning section (around line 205):

```tsx
{missingApiKey ? (
  <section className="p-3 text-sm text-amber-100">
    {settings?.provider === "custom"
      ? "Add your API key in Settings for the custom provider before sending requests."
      : "Add your OpenAI API key in Settings before sending requests."}
  </section>
) : null}
```

- [ ] **Step 2: Commit**

```bash
git add entrypoints/sidepanel/App.tsx
git commit -m "feat: update API key checks to support custom provider"
```

---

### Task 8: Update Settings Panel UI

**Files:**
- Modify: `entrypoints/sidepanel/components/SettingsPanel.tsx`

- [ ] **Step 1: Rewrite SettingsPanel with provider toggle and custom fields**

Edit `entrypoints/sidepanel/components/SettingsPanel.tsx`:

```tsx
import { useState } from "react";
import { OPENAI_MODEL_PRESETS } from "../../../src/lib/ai/models";
import type { Settings, CustomProviderConfig } from "../../../src/lib/storage/types";
import type { TestConnectionResponse } from "../../../src/lib/messaging/types";

export function SettingsPanel(props: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  function updateField<K extends keyof Settings>(key: K, value: Settings[K]) {
    props.onChange({ ...props.settings, [key]: value, updatedAt: new Date().toISOString() });
  }

  function updateCustomProvider(field: keyof CustomProviderConfig, value: string) {
    const current = props.settings.customProvider ?? { baseUrl: "", apiKey: "", model: "" };
    props.onChange({
      ...props.settings,
      customProvider: { ...current, [field]: value },
      updatedAt: new Date().toISOString()
    });
  }

  async function handleTestConnection() {
    const cp = props.settings.customProvider;
    if (!cp?.baseUrl || !cp?.apiKey || !cp?.model) {
      setTestResult({ ok: false, message: "Fill in Base URL, API Key, and Model first." });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response: TestConnectionResponse = await chrome.runtime.sendMessage({
        type: "TEST_CONNECTION",
        requestId: crypto.randomUUID(),
        baseUrl: cp.baseUrl,
        apiKey: cp.apiKey,
        model: cp.model
      });

      if (response.ok) {
        setTestResult({ ok: true, message: "Connected successfully." });
      } else {
        setTestResult({ ok: false, message: response.error });
      }
    } catch {
      setTestResult({ ok: false, message: "Failed to send test request." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="space-y-3 p-3">
      <label className="block text-xs text-zinc-400">
        AI Provider
        <select
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
          value={props.settings.provider}
          onChange={(e) => {
            const provider = e.target.value as "openai" | "custom";
            props.onChange({ ...props.settings, provider, updatedAt: new Date().toISOString() });
          }}
        >
          <option value="openai">OpenAI</option>
          <option value="custom">Custom Provider</option>
        </select>
      </label>

      {props.settings.provider === "openai" ? (
        <>
          <p className="rounded border border-amber-700 bg-amber-950 p-2 text-xs text-amber-100">
            Your API key is stored locally in Chrome extension storage for this private MVP. It is not encrypted secret storage.
          </p>
          <label className="block text-xs text-zinc-400">
            OpenAI API key
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              type="password"
              value={props.settings.openaiApiKey ?? ""}
              onChange={(e) => updateField("openaiApiKey", e.target.value)}
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Model preset
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              value={props.settings.modelPreset}
              onChange={(e) => updateField("modelPreset", e.target.value)}
            >
              {OPENAI_MODEL_PRESETS.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-400">
            Custom model
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              value={props.settings.customModel ?? ""}
              onChange={(e) => updateField("customModel", e.target.value)}
            />
          </label>
        </>
      ) : (
        <>
          <label className="block text-xs text-zinc-400">
            Base URL
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              placeholder="https://api.opencode.ai/v1/chat/completions"
              value={props.settings.customProvider?.baseUrl ?? ""}
              onChange={(e) => updateCustomProvider("baseUrl", e.target.value)}
            />
          </label>
          <label className="block text-xs text-zinc-400">
            API Key
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              type="password"
              value={props.settings.customProvider?.apiKey ?? ""}
              onChange={(e) => updateCustomProvider("apiKey", e.target.value)}
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Model
            <input
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
              placeholder="gpt-4o-mini"
              value={props.settings.customProvider?.model ?? ""}
              onChange={(e) => updateCustomProvider("model", e.target.value)}
            />
          </label>
          <div className="space-y-2">
            <button
              className="w-full rounded bg-zinc-700 px-3 py-2 text-sm text-zinc-50 hover:bg-zinc-600 disabled:opacity-50"
              disabled={testing}
              onClick={handleTestConnection}
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {testResult ? (
              <p className={`text-xs ${testResult.ok ? "text-green-400" : "text-red-400"}`}>
                {testResult.message}
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Build and check for TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add entrypoints/sidepanel/components/SettingsPanel.tsx
git commit -m "feat: add provider toggle and custom provider fields to settings"
```

---

### Verification

**Files:**
- Run: `npx vitest run`
  Expected: All existing tests + new tests pass

- Run: `npm run compile` (tsc check)
  Expected: No TypeScript errors
