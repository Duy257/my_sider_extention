# Thinking Mode Toggle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 5-level (Off/Low/Medium/High/Max) thinking mode toggle to Settings (global) and ChatComposer (per-chat override) that injects provider-specific API parameters.

**Architecture:** New `thinkingMode` field on `Settings` → `ProviderRuntimeConfig` → `extraBodyParams` injected into `streamChatCompletion`/`fetchCompletion`/`testConnection`. Provider param mapping centralized in `runtime.ts`. Per-chat override flows through `AiPortRequest.thinkingMode`.

**Tech Stack:** TypeScript 5, React 19, Tailwind CSS, WXT, Vitest

## Global Constraints

- All user-facing strings in Vietnamese (vi)
- `SchemaVersion` stays at 3 (additive field, no migration needed)
- Follow existing SettingsPanel card pattern (rounded-2xl, bg-surface, etc.)
- Use `expect.objectContaining` in tests matching existing patterns
- `Settings` field name: `thinkingMode` with type `"off" | "low" | "medium" | "high" | "max"`

---

### Task 1: Data Model — Add thinkingMode to Settings

**Files:**
- Modify: `src/lib/storage/types.ts:3-9`
- Modify: `src/lib/storage/defaults.ts:5-13`
- Test: `tests/storage/defaults.test.ts` (create)

**Interfaces:**
- Consumes: existing `Settings` type
- Produces: `Settings` with `thinkingMode: "off" | "low" | "medium" | "high" | "max"` field

- [ ] **Step 1: Add thinkingMode to Settings type**

Edit `src/lib/storage/types.ts`:

```typescript
export type Settings = {
  providerId: string;
  apiKeys: Record<string, string | undefined>;
  selectedModels: Record<string, string | undefined>;
  defaultLanguage: "vi" | "en";
  thinkingMode: "off" | "low" | "medium" | "high" | "max";
  updatedAt: string;
};
```

- [ ] **Step 2: Add default value**

Edit `src/lib/storage/defaults.ts`:

```typescript
export function createDefaultSettings(now = new Date().toISOString()): Settings {
  return {
    providerId: getDefaultProviderId(),
    apiKeys: {},
    selectedModels: {},
    defaultLanguage: "vi",
    thinkingMode: "off",
    updatedAt: now
  };
}
```

- [ ] **Step 3: Create test verifying default has thinkingMode: "off"**

Create `tests/storage/defaults.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createDefaultSettings } from "../../src/lib/storage/defaults";

describe("createDefaultSettings", () => {
  it("has thinkingMode off by default", () => {
    const settings = createDefaultSettings("2026-07-10T00:00:00.000Z");
    expect(settings.thinkingMode).toBe("off");
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/storage/defaults.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/types.ts src/lib/storage/defaults.ts tests/storage/defaults.test.ts
git commit -m "feat: add thinkingMode field to Settings"
```

---

### Task 2: Provider Parameter Mapping — getThinkingParams in runtime.ts

**Files:**
- Modify: `src/lib/ai/runtime.ts`
- Test: `tests/ai/runtime.test.ts`

**Interfaces:**
- Consumes: `ProviderRuntimeConfig` gains `thinkingMode`
- Produces: `getThinkingParams(providerId, mode): Record<string, unknown> | undefined`

- [ ] **Step 1: Add thinkingMode to ProviderRuntimeConfig and add THINKING_PARAM_MAP + getThinkingParams**

Edit `src/lib/ai/runtime.ts`. Add after imports:

```typescript
const THINKING_PARAM_MAP: Record<string, Record<string, Record<string, unknown> | undefined>> = {
  openai: {
    off: undefined,
    low: { reasoning_effort: "low" },
    medium: { reasoning_effort: "medium" },
    high: { reasoning_effort: "high" },
    max: { reasoning_effort: "high" },
  },
  opencode: {
    off: undefined,
    low: { reasoning_effort: "low" },
    medium: { reasoning_effort: "medium" },
    high: { reasoning_effort: "high" },
    max: { reasoning_effort: "high" },
  },
};

export function getThinkingParams(
  providerId: string,
  mode: "off" | "low" | "medium" | "high" | "max"
): Record<string, unknown> | undefined {
  return THINKING_PARAM_MAP[providerId]?.[mode];
}
```

Add `thinkingMode` to `ProviderRuntimeConfig`:

```typescript
export type ProviderRuntimeConfig = {
  providerId: string;
  providerLabel: string;
  baseUrl: string;
  modelUrl: string;
  apiKey?: string;
  model: string;
  requiresApiKey: boolean;
  knownModels: string[];
  thinkingMode: "off" | "low" | "medium" | "high" | "max";
};
```

In `resolveProviderRuntimeConfig`, add `thinkingMode` to the returned config:

```typescript
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
    knownModels: provider.knownModels,
    thinkingMode: settings.thinkingMode ?? "off",
  }
};
```

- [ ] **Step 2: Add tests for getThinkingParams**

Add to `tests/ai/runtime.test.ts`:

```typescript
import { getThinkingParams, resolveProviderRuntimeConfig } from "../../src/lib/ai/runtime";

describe("getThinkingParams", () => {
  it("returns reasoning_effort for openai medium", () => {
    expect(getThinkingParams("openai", "medium")).toEqual({ reasoning_effort: "medium" });
  });

  it("returns undefined for off", () => {
    expect(getThinkingParams("openai", "off")).toBeUndefined();
  });

  it("maps max to high for openai", () => {
    expect(getThinkingParams("openai", "max")).toEqual({ reasoning_effort: "high" });
  });

  it("returns undefined for unknown provider", () => {
    expect(getThinkingParams("lmstudio", "medium")).toBeUndefined();
  });

  it("returns reasoning_effort for opencode medium", () => {
    expect(getThinkingParams("opencode", "medium")).toEqual({ reasoning_effort: "medium" });
  });
});
```

Update existing `resolveProviderRuntimeConfig` test to check `thinkingMode` is passed through:

Add to the first test in `describe("resolveProviderRuntimeConfig")`:

```typescript
it("passes thinkingMode from settings to config", () => {
  expect(resolveProviderRuntimeConfig(settings({
    providerId: "opencode",
    apiKeys: { opencode: "sk-open" },
    selectedModels: { opencode: "gpt-4o" },
    thinkingMode: "high"
  }))).toEqual({
    ok: true,
    config: expect.objectContaining({
      providerId: "opencode",
      thinkingMode: "high"
    })
  });
});

it("defaults thinkingMode to off when missing", () => {
  const s = settings({ apiKeys: { opencode: "sk" }, selectedModels: { opencode: "m" }, providerId: "opencode" });
  delete (s as any).thinkingMode;
  expect(resolveProviderRuntimeConfig(s)).toEqual({
    ok: true,
    config: expect.objectContaining({ thinkingMode: "off" })
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/ai/runtime.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/runtime.ts tests/ai/runtime.test.ts
git commit -m "feat: add thinking params mapping in runtime"
```

---

### Task 3: AI Client — Inject extraBodyParams

**Files:**
- Modify: `src/lib/ai/client.ts`
- Test: `tests/ai/client.test.ts`

**Interfaces:**
- Consumes: `extraBodyParams?: Record<string, unknown>` on `streamChatCompletion`, `fetchCompletion`, `testConnection`
- Produces: Request body includes merged `extraBodyParams`

- [ ] **Step 1: Add extraBodyParams to streamChatCompletion and merge into body**

Edit `src/lib/ai/client.ts`. Add `extraBodyParams` to the input type of `streamChatCompletion`:

```typescript
export async function streamChatCompletion(input: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: AiMessage[];
  signal?: AbortSignal;
  extraBodyParams?: Record<string, unknown>;
  callbacks: StreamCallbacks;
}): Promise<void> {
```

Update the `body: JSON.stringify(...)` call:

```typescript
body: JSON.stringify({
  model: input.model,
  messages: input.messages.map((m) => ({
    role: m.role,
    content: m.content,
  })),
  stream: true,
  ...input.extraBodyParams,
}),
```

- [ ] **Step 2: Add extraBodyParams to fetchCompletion and testConnection**

In `fetchCompletion`:

```typescript
export async function fetchCompletion(input: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: AiMessage[];
  signal?: AbortSignal;
  extraBodyParams?: Record<string, unknown>;
}): Promise<...> {
```

Update body:

```typescript
body: JSON.stringify({
  model: input.model,
  messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  stream: false,
  ...input.extraBodyParams,
}),
```

In `testConnection`:

```typescript
export async function testConnection(input: {
  baseUrl: string;
  apiKey?: string;
  model: string;
  extraBodyParams?: Record<string, unknown>;
}): Promise<...> {
```

Update body:

```typescript
body: JSON.stringify({
  model: input.model,
  messages: [{ role: "user", content: "Hi" }],
  max_tokens: 10,
  stream: false,
  ...input.extraBodyParams,
}),
```

- [ ] **Step 3: Add test for extraBodyParams in stream**

Add to `tests/ai/client.test.ts` in `describe("streamChatCompletion")`:

```typescript
it("merges extraBodyParams into request body", async () => {
  const sse = [
    'data: {"id":"1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
    "data: [DONE]\n\n"
  ];

  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    body: createMockSSE(sse)
  });
  vi.stubGlobal("fetch", mockFetch);

  await streamChatCompletion({
    baseUrl: "https://api.openai.com/v1/chat/completions",
    apiKey: "sk-test",
    model: "o3-mini",
    messages: [{ role: "user", content: "Think hard" }],
    extraBodyParams: { reasoning_effort: "high" },
    callbacks: { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() }
  });

  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body.reasoning_effort).toBe("high");

  vi.unstubAllGlobals();
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/ai/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/client.ts tests/ai/client.test.ts
git commit -m "feat: inject extraBodyParams into AI client requests"
```

---

### Task 4: Background — Wire thinking params from runtime config

**Files:**
- Modify: `entrypoints/background.ts`
- Modify: `src/lib/messaging/types.ts`

**Interfaces:**
- Consumes: `getThinkingParams(providerId, mode)`, `extraBodyParams` on `streamChatCompletion`
- Produces: `AiPortRequest` gains optional `thinkingMode`

- [ ] **Step 1: Add thinkingMode to AiPortRequest**

Edit `src/lib/messaging/types.ts`:

```typescript
export type AiPortRequest = {
  type: "AI_CHAT_REQUEST";
  requestId: string;
  messages: AiMessage[];
  thinkingMode?: "off" | "low" | "medium" | "high" | "max";
};
```

- [ ] **Step 2: Wire thinking params in background.ts**

Edit `entrypoints/background.ts`. Add import:

```typescript
import { getThinkingParams, resolveProviderRuntimeConfig } from "../src/lib/ai/runtime";
```

In the `port.onMessage` handler, update the `streamChatCompletion` call to include `extraBodyParams`:

```typescript
// Resolve thinking params
const thinkingMode = message.thinkingMode ?? runtime.config.thinkingMode;
const extraBodyParams = getThinkingParams(runtime.config.providerId, thinkingMode);

await streamChatCompletion({
  baseUrl: runtime.config.baseUrl,
  apiKey: runtime.config.apiKey,
  model: runtime.config.model,
  messages: message.messages,
  extraBodyParams,
  signal: controller.signal,
  callbacks: { ... }
});
```

- [ ] **Step 3: Run type check**

Run: `npm run compile`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add entrypoints/background.ts src/lib/messaging/types.ts
git commit -m "feat: wire thinking params in background and port messaging"
```

---

### Task 5: Settings Panel UI — Thinking Mode Dropdown

**Files:**
- Modify: `entrypoints/sidepanel/components/SettingsPanel.tsx`

- [ ] **Step 1: Add thinking mode card after Model card**

Insert between Model card and Connection Test card in `SettingsPanel.tsx`:

```typescript
      {/* Thinking Mode Card */}
      <div className="rounded-2xl bg-surface border border-stone-850 p-4 shadow-sm hover:border-stone-800 transition-all duration-300">
        <label htmlFor="thinking-select" className="block text-xs font-semibold text-stone-400 uppercase tracking-wider">
          🧠 Tư duy (Thinking)
        </label>
        <div className="relative mt-2">
          <select
            id="thinking-select"
            className="w-full appearance-none rounded-xl border border-stone-850 bg-warm-bg px-3.5 py-3 text-[13.5px] font-medium text-stone-100 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/45 transition-colors shadow-inner"
            value={props.settings.thinkingMode ?? "off"}
            onChange={(event) => commit(createNextSettings({ thinkingMode: event.target.value as Settings["thinkingMode"] }))}
          >
            <option value="off">Tắt (Off)</option>
            <option value="low">Thấp (Low)</option>
            <option value="medium">Vừa (Medium)</option>
            <option value="high">Cao (High)</option>
            <option value="max">Tối đa (Max)</option>
          </select>
          <ChevronIcon />
        </div>
        <p className="mt-2 text-xs text-stone-500 leading-relaxed">
          Kích hoạt tư duy sâu cho các model hỗ trợ. Thay đổi áp dụng cho mọi hội thoại.
        </p>
      </div>
```

Place this block right before the Connection Test card (before the `{/* Connection Test Card */}` comment).

- [ ] **Step 2: Verify the component renders correctly**

Run: `npm run compile`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add entrypoints/sidepanel/components/SettingsPanel.tsx
git commit -m "feat: add thinking mode dropdown to settings panel"
```

---

### Task 6: Per-Chat Override — ChatComposer + useChatController

**Files:**
- Modify: `entrypoints/sidepanel/hooks/useChatController.ts`
- Modify: `entrypoints/sidepanel/components/ChatComposer.tsx`

- [ ] **Step 1: Add thinkingMode override to useChatController.sendPrompt**

Edit `entrypoints/sidepanel/hooks/useChatController.ts`:

Change `sendPrompt` signature:

```typescript
sendPrompt: (text: string, thinkingMode?: "off" | "low" | "medium" | "high" | "max") => void;
```

Update the `sendPrompt` implementation to accept an optional `thinkingMode` parameter and include it in the port message:

```typescript
function sendPrompt(text: string, thinkingMode?: "off" | "low" | "medium" | "high" | "max") {
  const trimmed = text.trim();
  if (!trimmed || !canSend || streamingRef.current) return;
  // ... existing setup code ...

  port.postMessage({
    type: "AI_CHAT_REQUEST",
    requestId,
    messages: providerMessages,
    ...(thinkingMode ? { thinkingMode } : {})
  });
}
```

- [ ] **Step 2: Add thinking dropdown to ChatComposer**

Edit `entrypoints/sidepanel/components/ChatComposer.tsx`:

Update the `ChatComposer` props to include `onSend` with thinking support + `defaultThinkingMode`:

```typescript
export function ChatComposer(props: {
  disabled: boolean;
  onSend: (text: string, thinkingMode?: "off" | "low" | "medium" | "high" | "max") => void;
  showMissingKeyBanner?: boolean;
  missingType?: "key" | "model";
  providerLabel?: string;
  sending?: boolean;
  defaultThinkingMode?: "off" | "low" | "medium" | "high" | "max";
}) {
  const [value, setValue] = useState("");
  const [thinkingMode, setThinkingMode] = useState<"off" | "low" | "medium" | "high" | "max">(
    props.defaultThinkingMode ?? "off"
  );
```

Reset `thinkingMode` after send. In `handleSubmit`:

```typescript
const handleSubmit = (event: React.FormEvent) => {
  event.preventDefault();
  const text = value.trim();
  if (!text || props.disabled) return;
  props.onSend(text, thinkingMode);
  setValue("");
  setThinkingMode(props.defaultThinkingMode ?? "off");
};
```

Same in `handleKeyDown`:

```typescript
const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    const text = value.trim();
    if (!text || props.disabled) return;
    props.onSend(text, thinkingMode);
    setValue("");
    setThinkingMode(props.defaultThinkingMode ?? "off");
  }
};
```

Add the thinking dropdown before the textarea in the form:

```typescript
<form className="relative flex items-end w-full group/form" onSubmit={handleSubmit}>
  <div className="flex items-end gap-2 w-full">
    <div className="relative flex-shrink-0">
      <select
        className="appearance-none rounded-xl border border-stone-850 bg-surface/90 px-2.5 py-2.5 text-[11px] font-medium text-stone-400 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/45 transition-colors cursor-pointer min-w-[90px]"
        value={thinkingMode}
        onChange={(e) => setThinkingMode(e.target.value as any)}
        disabled={props.disabled}
        title="Mức tư duy"
      >
        <option value="off">🧠 Tắt</option>
        <option value="low">Thấp</option>
        <option value="medium">Vừa</option>
        <option value="high">Cao</option>
        <option value="max">Tối đa</option>
      </select>
    </div>
    <textarea
      // existing textarea props...
    />
    <button
      // existing button...
    />
  </div>
</form>
```

Update the form structure — wrap textarea + button in a relative container alongside the dropdown.

- [ ] **Step 3: Run type check**

Run: `npm run compile`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add entrypoints/sidepanel/hooks/useChatController.ts entrypoints/sidepanel/components/ChatComposer.tsx
git commit -m "feat: add per-chat thinking mode override in composer"
```

---

### Task 7: Wire ChatComposer with Settings in App.tsx

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx` (or wherever `ChatComposer` is consumed)

- [ ] **Step 1: Find where ChatComposer is used and pass defaultThinkingMode**

Search for `<ChatComposer` usage in `entrypoints/sidepanel/App.tsx`:

```typescript
<ChatComposer
  disabled={!canSend}
  onSend={(text, thinkingMode) => chat.sendPrompt(text, thinkingMode)}
  showMissingKeyBanner={missingKeyOrModel}
  missingType={missingType}
  providerLabel={providerLabel}
  sending={chat.streaming}
  defaultThinkingMode={settings?.thinkingMode}
/>
```

- [ ] **Step 2: Run type check**

Run: `npm run compile`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add entrypoints/sidepanel/App.tsx
git commit -m "feat: wire thinking mode from settings into chat composer"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full type check**

Run: `npm run compile`
Expected: No type errors

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Run lint if configured**

Run: `npm run lint` (if available)
Expected: No lint errors
