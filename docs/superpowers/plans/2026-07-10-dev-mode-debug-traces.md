# Dev Mode Inline Debug Traces Implementation Plan

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan task-by-task. Dispatch a fresh implementation worker per task, then run a spec-compliance review followed by a code-quality review before starting the next task.

**Goal:** Add a persisted Developer Mode that renders inline AI reasoning, effective thinking mode/parameters, provider token usage, and extension-operation traces in Sidepanel, selection Floating Window, and Reader.

**Architecture:** `src/lib/devtools/` holds pure trace types, SSE normalization, trace reducers, background trace emitters, display copy, and reusable React trace components. The MV3 background is the only source of debug Port/runtime messages; every UI surface stores request-scoped traces and renders the shared components inline. Traces are ephemeral and redacted.

**Tech Stack:** TypeScript 5 strict mode, React 19, WXT MV3, Tailwind CSS, Vitest 4, React Testing Library.

**Approved design:** `docs/superpowers/specs/2026-07-10-dev-mode-debug-traces-design.md`

**Baseline verified on 2026-07-10:** `npm run compile` passed; `npx vitest run` passed with 23 test files and 105 tests.

---

## Global constraints

- Keep all normal user-facing UI strings in Vietnamese.
- New Developer Mode strings must be sourced from `src/lib/devtools/copy.ts`; do not hardcode them in React components.
- `devMode` defaults to `false`; no debug trace is persisted in `SavedResult` or `chrome.storage.local`.
- Never include API keys, prompts, selection text, full page content, or arbitrary raw request params in a trace.
- `thinkingMode` remains a functional control in Settings/ChatComposer; Developer Mode only observes and renders diagnostics.
- Content deltas must continue rendering if debug parsing fails or a provider sends no reasoning/usage.
- Use `npx vitest run`, not watch mode, in all plan commands.
- Every implementation task follows RED → GREEN → commit, then receives two independent reviews.

## Shared test helpers

Use the existing patterns before adding new mocks:

- `tests/setup.ts` exposes `createListenerContainer()` and `portEntries` for Chrome Port tests.
- `tests/ai/client.test.ts` already has `createMockSSE(chunks)` for deterministic SSE fixtures.
- `tests/storage/storage.test.ts` already asserts exact storage defaults/migration results.
- UI tests use `@testing-library/react` and `userEvent` as seen in `tests/sidepanel-settings.test.tsx` and `tests/chat-message.test.tsx`.

---

### Task 1: Create Dev Trace contracts and centralized copy

**Objective:** Define UI-independent trace data and all new Vietnamese display copy without touching storage or transport yet.

**Files:**
- Create: `src/lib/devtools/types.ts`
- Create: `src/lib/devtools/copy.ts`
- Test: `tests/lib/messaging/types.test.ts`

**Step 1: Write the contract compilation test first**

Add an import for the new types to `tests/lib/messaging/types.test.ts` and compile representative values. The test must cover every public feature and status literal:

```ts
import type { AiDevTrace, ToolDevTrace } from "../../src/lib/devtools/types";

it("accepts ephemeral AI and tool dev trace contracts", () => {
  const aiTrace: AiDevTrace = {
    requestId: "request-1",
    surface: "sidepanel",
    feature: "chat",
    status: "pending",
    providerId: "openai",
    model: "gpt-5.4-mini",
    requestedThinkingMode: "high",
    effectiveRequestParams: { reasoning_effort: "high" },
    startedAt: 100,
    thinking: { state: "pending", content: "" }
  };
  const toolTrace: ToolDevTrace = {
    requestId: "tool-1",
    tool: "read-page",
    status: "success",
    startedAt: 100,
    finishedAt: 150,
    metadata: { extractor: "readability", contentChars: 420 }
  };
  expect(aiTrace.feature).toBe("chat");
  expect(toolTrace.metadata.contentChars).toBe(420);
});
```

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/lib/messaging/types.test.ts
```

Expected: FAIL because `src/lib/devtools/types.ts` does not exist.

**Step 3: Implement the exact contracts**

Create `src/lib/devtools/types.ts` with these public types. Keep metadata values scalar so components cannot accidentally receive large or secret objects.

```ts
import type { Settings } from "../storage/types";

export type DevSurface = "sidepanel" | "floating" | "reader";
export type AiDevFeature =
  | "chat"
  | "selection-response"
  | "reader-summary"
  | "reader-qa"
  | "reader-definition";
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

export type AiDevContext = {
  surface: DevSurface;
  feature: AiDevFeature;
};

export type AiDevTrace = {
  requestId: string;
  surface: DevSurface;
  feature: AiDevFeature;
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

Create `src/lib/devtools/copy.ts` as a single source for new visible strings. Components may compose scalar values but must reference these labels.

```ts
export const DEV_COPY = {
  settingsLabel: "Developer mode",
  settingsToggle: "Bật Dev Mode",
  settingsHelp: "Hiển thị reasoning, tham số request, token usage và trace thao tác extension để phục vụ phát triển.",
  summaryPrefix: "DEV",
  request: "REQUEST",
  thinking: "THINKING",
  usage: "USAGE",
  unavailableUsage: "N/A — provider không gửi usage",
  thinkingNotReturned: "Provider không gửi reasoning.",
  copyThinking: "Sao chép reasoning",
  copied: "Đã sao chép",
  tool: "TOOL",
  status: "STATUS",
} as const;
```

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/lib/messaging/types.test.ts
npm run compile
```

Expected: PASS; no TypeScript errors.

**Step 5: Commit**

```sh
git add src/lib/devtools/types.ts src/lib/devtools/copy.ts tests/lib/messaging/types.test.ts
git commit -m "feat: add dev trace contracts"
```

---

### Task 2: Normalize provider debug fields and reduce trace state

**Objective:** Safely extract reasoning, token usage, and finish reason from parsed SSE JSON, then update traces through pure reducers.

**Files:**
- Create: `src/lib/devtools/stream.ts`
- Create: `src/lib/devtools/trace-reducer.ts`
- Test: `tests/devtools/stream.test.ts`
- Test: `tests/devtools/trace-reducer.test.ts`

**Step 1: Write failing normalizer tests**

Cover these cases in `tests/devtools/stream.test.ts`:

1. `delta.reasoning_content` is accepted as `reasoningDelta`.
2. `delta.reasoning` is accepted when `reasoning_content` is absent.
3. `usage.prompt_tokens`, `usage.completion_tokens`, and `usage.total_tokens` map to the internal names.
4. A non-integer, negative integer, array, object, or empty finish reason is ignored.
5. Content-only chunks return an empty debug event rather than throwing.

Use a fixture similar to:

```ts
expect(readStreamDebugEvent({
  choices: [{ delta: { reasoning_content: "Plan first" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 }
})).toEqual({
  reasoningDelta: "Plan first",
  finishReason: "stop",
  usage: { inputTokens: 12, outputTokens: 7, totalTokens: 19 }
});
```

In `tests/devtools/trace-reducer.test.ts`, create a baseline `AiDevTrace`, apply reasoning, usage, first-token, done, and error updates, and assert that no reducer mutates the original object.

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/devtools/stream.test.ts tests/devtools/trace-reducer.test.ts
```

Expected: FAIL because both modules are absent.

**Step 3: Implement small pure functions**

`src/lib/devtools/stream.ts` must avoid `any` and use record guards:

```ts
export type StreamDebugEvent = {
  reasoningDelta?: string;
  usage?: TokenUsage;
  finishReason?: string;
};

export function readStreamDebugEvent(parsed: unknown): StreamDebugEvent {
  const root = asRecord(parsed);
  const choice = Array.isArray(root.choices) ? asRecord(root.choices[0]) : {};
  const delta = asRecord(choice.delta);
  const reasoningDelta = readNonEmptyString(delta.reasoning_content)
    ?? readNonEmptyString(delta.reasoning);
  const usage = readTokenUsage(root.usage);
  const finishReason = readNonEmptyString(choice.finish_reason);
  return {
    ...(reasoningDelta ? { reasoningDelta } : {}),
    ...(usage ? { usage } : {}),
    ...(finishReason ? { finishReason } : {})
  };
}
```

`src/lib/devtools/trace-reducer.ts` must expose immutable helpers such as:

```ts
export function appendReasoning(trace: AiDevTrace, delta: string): AiDevTrace {
  return {
    ...trace,
    thinking: { state: "returned", content: trace.thinking.content + delta }
  };
}

export function finishAiTrace(trace: AiDevTrace, now: number): AiDevTrace {
  return {
    ...trace,
    status: "success",
    finishedAt: now,
    thinking: trace.thinking.content
      ? trace.thinking
      : { state: "not-returned", content: "" }
  };
}
```

Include named helpers `markFirstToken(trace, now)`, `applyDebugUpdate(trace, update)`, and `finishAiTrace(trace, now)`. `applyDebugUpdate` accepts `{ usage?: TokenUsage; finishReason?: string }`; also add failure/cancellation/interruption finalizers.

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/devtools/stream.test.ts tests/devtools/trace-reducer.test.ts
npm run compile
```

Expected: PASS.

**Step 5: Commit**

```sh
git add src/lib/devtools/stream.ts src/lib/devtools/trace-reducer.ts tests/devtools/stream.test.ts tests/devtools/trace-reducer.test.ts
git commit -m "feat: normalize AI dev trace events"
```

---

### Task 3: Persist Developer Mode and repair settings migration

**Objective:** Add `devMode`, increment schema to v5, and stop migration from resetting an existing valid thinking mode.

**Files:**
- Modify: `src/lib/storage/types.ts:3-10`
- Modify: `src/lib/storage/defaults.ts:5-14`
- Modify: `src/lib/storage/migrations.ts:4-79`
- Modify: `tests/storage/defaults.test.ts`
- Modify: `tests/storage/storage.test.ts:5-99`

**Step 1: Write failing storage tests**

Add these assertions:

```ts
expect(createDefaultSettings("2026-07-10T00:00:00.000Z")).toMatchObject({
  thinkingMode: "off",
  devMode: false
});
expect(CURRENT_SCHEMA_VERSION).toBe(5);
```

Add a v4 envelope fixture with `thinkingMode: "high"` and assert migration returns:

```ts
expect(migrated.data).toMatchObject({
  thinkingMode: "high",
  devMode: false
});
```

Also assert invalid values fall back safely:

```ts
expect(migrateSettingsEnvelope({
  schemaVersion: 4,
  data: { providerId: "openai", thinkingMode: "invalid", devMode: "yes" }
}, createDefaultSettings("fallback")).data).toMatchObject({
  thinkingMode: "off",
  devMode: false
});
```

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/storage/defaults.test.ts tests/storage/storage.test.ts
```

Expected: FAIL because `devMode` and schema v5 do not exist.

**Step 3: Implement minimal migration**

Add `devMode: boolean` to `Settings` and `devMode: false` to `createDefaultSettings`.

In `migrations.ts`, make valid thinking mode explicit rather than unconditionally setting `"off"`:

```ts
const THINKING_MODES = new Set(["off", "low", "medium", "high", "max"]);

function readThinkingMode(value: unknown): Settings["thinkingMode"] {
  return typeof value === "string" && THINKING_MODES.has(value)
    ? value as Settings["thinkingMode"]
    : "off";
}
```

Update the returned settings object:

```ts
thinkingMode: readThinkingMode(data.thinkingMode),
devMode: data.devMode === true,
```

Set `CURRENT_SCHEMA_VERSION = 5`.

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/storage/defaults.test.ts tests/storage/storage.test.ts
npm run compile
```

Expected: PASS.

**Step 5: Commit**

```sh
git add src/lib/storage/types.ts src/lib/storage/defaults.ts src/lib/storage/migrations.ts tests/storage/defaults.test.ts tests/storage/storage.test.ts
git commit -m "feat: persist developer mode setting"
```

---

### Task 4: Add Developer Mode control to Settings

**Objective:** Let the user persist the global toggle from the existing Settings surface.

**Files:**
- Modify: `entrypoints/sidepanel/components/SettingsPanel.tsx:279-304`
- Modify: `tests/sidepanel-settings.test.tsx`

**Step 1: Write the failing component test**

```tsx
it("persists Developer Mode from the settings checkbox", async () => {
  const onChange = vi.fn();
  render(<SettingsPanel settings={settings()} onChange={onChange} />);

  await userEvent.click(screen.getByLabelText(DEV_COPY.settingsToggle));

  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ devMode: true }));
});
```

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/sidepanel-settings.test.tsx
```

Expected: FAIL because the checkbox does not exist.

**Step 3: Implement the card after Thinking and before Connection Test**

Use a normal checkbox and label; do not invent an icon, gradient, pill switch, or new shadow. Reuse `createNextSettings` and `commit`:

```tsx
<div className="rounded-2xl border border-stone-850 bg-surface p-4 transition-colors duration-300 hover:border-stone-800">
  <label htmlFor="dev-mode-toggle" className="flex cursor-pointer items-start gap-3">
    <input
      id="dev-mode-toggle"
      type="checkbox"
      className="mt-0.5 h-4 w-4 accent-primary"
      checked={props.settings.devMode}
      onChange={(event) => commit(createNextSettings({ devMode: event.target.checked }))}
    />
    <span>
      <span className="block text-xs font-semibold uppercase tracking-wider text-stone-400">
        {DEV_COPY.settingsLabel}
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-stone-500">
        {DEV_COPY.settingsHelp}
      </span>
    </span>
  </label>
</div>
```

Import `DEV_COPY` from `src/lib/devtools/copy` with the repository’s explicit relative-import style.

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/sidepanel-settings.test.tsx
npm run compile
```

Expected: PASS.

**Step 5: Commit**

```sh
git add entrypoints/sidepanel/components/SettingsPanel.tsx tests/sidepanel-settings.test.tsx
git commit -m "feat: add developer mode settings control"
```

---

### Task 5: Resolve runtime Dev Mode and safe OpenAI usage params

**Objective:** Carry `devMode` through runtime configuration and add `stream_options.include_usage` only for the configured OpenAI provider.

**Files:**
- Modify: `src/lib/ai/runtime.ts:6-88`
- Modify: `tests/ai/runtime.test.ts:5-117`

**Step 1: Write failing runtime tests**

Add assertions for both runtime setting propagation and provider safety:

```ts
expect(resolveProviderRuntimeConfig(settings({
  providerId: "openai",
  apiKeys: { openai: "sk" },
  selectedModels: { openai: "gpt-5.4-mini" },
  devMode: true
}))).toEqual({ ok: true, config: expect.objectContaining({ devMode: true }) });

expect(getDevStreamParams("openai", true)).toEqual({
  stream_options: { include_usage: true }
});
expect(getDevStreamParams("opencode", true)).toBeUndefined();
expect(getDevStreamParams("openai", false)).toBeUndefined();
```

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/ai/runtime.test.ts
```

Expected: FAIL because `devMode` and `getDevStreamParams` are missing.

**Step 3: Implement the small mapping**

Extend `ProviderRuntimeConfig` and the resolved config:

```ts
export type ProviderRuntimeConfig = {
  // existing fields
  thinkingMode: Settings["thinkingMode"];
  devMode: boolean;
};

// inside the success config
thinkingMode: settings.thinkingMode ?? "off",
devMode: settings.devMode === true,
```

Add a separate function; do not overload `getThinkingParams`:

```ts
export function getDevStreamParams(
  providerId: string,
  devMode: boolean
): Record<string, unknown> | undefined {
  if (!devMode || providerId !== "openai") return undefined;
  return { stream_options: { include_usage: true } };
}
```

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/ai/runtime.test.ts
npm run compile
```

Expected: PASS.

**Step 5: Commit**

```sh
git add src/lib/ai/runtime.ts tests/ai/runtime.test.ts
git commit -m "feat: resolve developer stream options"
```

---

### Task 6: Extend the AI client without breaking content streaming

**Objective:** Make `streamChatCompletion` report normalized debug values through optional callbacks and treat reasoning as first useful stream activity.

**Files:**
- Modify: `src/lib/ai/client.ts:95-102, 216-235`
- Modify: `tests/ai/client.test.ts:16-145`

**Step 1: Write failing SSE tests**

Add a multi-event fixture where reasoning arrives before content, then final usage/finish metadata:

```ts
const sse = [
  'data: {"choices":[{"delta":{"reasoning_content":"Plan"},"finish_reason":null}]}\n\n',
  'data: {"choices":[{"delta":{"content":"Answer"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":7,"total_tokens":19}}\n\n',
  "data: [DONE]\n\n"
];
```

Assert that `onReasoningDelta`, `onUsage`, `onFinishReason`, `onFirstToken`, and existing `onDelta` receive expected data. Add a malformed debug payload test that asserts `onDelta("Answer")` still runs and no error callback fires.

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/ai/client.test.ts
```

Expected: FAIL because the callback properties do not exist.

**Step 3: Implement optional callbacks with isolated parsing**

Extend `StreamCallbacks`:

```ts
type StreamCallbacks = {
  onConnecting?: () => void;
  onFirstToken?: () => void;
  onDelta: (delta: string) => void;
  onReasoningDelta?: (delta: string) => void;
  onUsage?: (usage: TokenUsage) => void;
  onFinishReason?: (finishReason: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};
```

Inside the existing parsed SSE block, call `readStreamDebugEvent(parsed)` in a separate `try` boundary. Deliver reasoning/usage/finish callbacks before/alongside content, but retain the current content callback behavior.

Use one local helper to mark first activity so reasoning prevents the 30-second watchdog from cancelling an otherwise active response:

```ts
function markFirstActivity() {
  if (hasReceivedFirstToken) return;
  hasReceivedFirstToken = true;
  clearTimeout(watchdogTimer);
  input.callbacks.onFirstToken?.();
}
```

Call it for either a non-empty content delta or a non-empty reasoning delta. Never call `onDelta` for reasoning.

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/ai/client.test.ts
npm run compile
```

Expected: PASS; all pre-existing client tests remain green.

**Step 5: Commit**

```sh
git add src/lib/ai/client.ts tests/ai/client.test.ts
git commit -m "feat: emit reasoning and usage stream metadata"
```

---

### Task 7: Add typed Dev Trace messages to the Port contract

**Objective:** Make debug context and lifecycle events explicit in `src/lib/messaging/types.ts` before changing background/UI code.

**Files:**
- Modify: `src/lib/messaging/types.ts:37-49`
- Modify: `tests/lib/messaging/types.test.ts`

**Step 1: Write failing type fixtures**

Add one `AiPortRequest` with `devContext`, then fixtures for debug start, reasoning, debug update, done-with-trace, and error-with-trace. Add a `LOAD_READER_ERROR` `ExtensionMessage` fixture with an optional `ToolDevTrace`.

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/lib/messaging/types.test.ts
```

Expected: Type/test failure because the variants are missing.

**Step 3: Implement typed variants**

Import `AiDevContext`, `AiDevTrace`, `ToolDevTrace`, `TokenUsage`, and `Settings` as type-only imports. Add only optional fields so non-dev flows stay source-compatible:

```ts
export type AiPortRequest = {
  type: "AI_CHAT_REQUEST";
  requestId: string;
  messages: AiMessage[];
  thinkingMode?: Settings["thinkingMode"];
  devContext?: AiDevContext;
};

export type AiPortResponse =
  | { type: "AI_STREAM_CONNECTING"; requestId: string }
  | { type: "AI_STREAM_FIRST_TOKEN"; requestId: string }
  | { type: "AI_STREAM_DEBUG_START"; requestId: string; trace: AiDevTrace }
  | { type: "AI_STREAM_REASONING"; requestId: string; delta: string }
  | { type: "AI_STREAM_CHUNK"; requestId: string; delta: string }
  | { type: "AI_STREAM_DEBUG_UPDATE"; requestId: string; usage?: TokenUsage; finishReason?: string }
  | { type: "AI_STREAM_DONE"; requestId: string; trace?: AiDevTrace }
  | { type: "AI_STREAM_ERROR"; requestId: string; message: string; trace?: AiDevTrace };
```

Extend `ExtensionMessage` with a precise `LOAD_READER_ERROR` shape rather than `any`.

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/lib/messaging/types.test.ts
npm run compile
```

Expected: PASS.

**Step 5: Commit**

```sh
git add src/lib/messaging/types.ts tests/lib/messaging/types.test.ts
git commit -m "feat: add dev trace port messages"
```

---

### Task 8: Implement testable background AI trace emission

**Objective:** Keep typed Port debug event assembly out of the WXT entrypoint and wire it into the existing `AI_STREAM_PORT` flow.

**Files:**
- Create: `src/lib/devtools/background-trace.ts`
- Modify: `entrypoints/background.ts:59-118`
- Test: `tests/background-dev-trace.test.ts`

**Step 1: Write failing pure-emitter tests**

Do not import `entrypoints/background.ts` in the test. Test the pure helper with a `send = vi.fn()` callback.

Cases:

1. `createAiTrace` allows only `reasoning_effort` and `stream_options` inside `effectiveRequestParams`.
2. `createAiPortTraceEmitter` sends `AI_STREAM_DEBUG_START`, accumulates reasoning, sends update data, and places a successful trace on done.
3. Error/cancellation finalize status correctly and retain partial reasoning.
4. No emitter is created when `devMode` is false.

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/background-dev-trace.test.ts
```

Expected: FAIL because the helper module is absent.

**Step 3: Implement pure helper API**

Expose a minimal API from `src/lib/devtools/background-trace.ts`:

```ts
export function createAiTrace(input: {
  requestId: string;
  context: AiDevContext;
  runtime: ProviderRuntimeConfig;
  thinkingMode: Settings["thinkingMode"];
  extraBodyParams?: Record<string, unknown>;
  now: number;
}): AiDevTrace;

export function createAiPortTraceEmitter(input: {
  trace: AiDevTrace;
  send: (message: AiPortResponse) => void;
  now: () => number;
}): {
  onReasoningDelta: (delta: string) => void;
  onFirstToken: () => void;
  onUsage: (usage: TokenUsage) => void;
  onFinishReason: (reason: string) => void;
  onDone: () => AiDevTrace;
  onError: (message: string, status?: "error" | "cancelled" | "interrupted") => AiDevTrace;
};
```

`createAiTrace` must call a local `pickSafeRequestParams` allow-list. It must not spread the full request object.

**Step 4: Wire the emitter into `background.ts`**

At the existing stream call around lines 87-107:

1. Compute the selected thinking mode exactly as today.
2. Merge `getThinkingParams` and `getDevStreamParams` without spreading `undefined`.
3. When `runtime.config.devMode` and `message.devContext` are both truthy, create the trace/emitter and send `AI_STREAM_DEBUG_START` before opening the client stream.
4. Pass emitter callbacks to `streamChatCompletion` only when it exists.
5. Keep existing `AI_STREAM_CONNECTING`, `AI_STREAM_FIRST_TOKEN`, `AI_STREAM_CHUNK`, and normal error behavior intact.
6. On done/error, attach the final trace only when emitted.

The essential merge is:

```ts
const thinkingParams = getThinkingParams(runtime.config.providerId, thinkingMode);
const devStreamParams = getDevStreamParams(runtime.config.providerId, runtime.config.devMode);
const extraBodyParams = thinkingParams || devStreamParams
  ? { ...(thinkingParams ?? {}), ...(devStreamParams ?? {}) }
  : undefined;
```

Pass `undefined` rather than `{}` when no parameter is present.

**Step 5: Verify GREEN**

Run:

```sh
npx vitest run tests/background-dev-trace.test.ts tests/ai/client.test.ts tests/ai/runtime.test.ts
npm run compile
```

Expected: PASS.

**Step 6: Commit**

```sh
git add src/lib/devtools/background-trace.ts entrypoints/background.ts tests/background-dev-trace.test.ts
git commit -m "feat: emit dev traces from AI background stream"
```

---

### Task 9: Add safe tool traces and Reader handoff cleanup in background

**Objective:** Return tool traces for Read Page, selection routing, and Reader opening; fix the Reader readiness-listener leak and indefinite loading state.

**Files:**
- Modify: `src/lib/devtools/background-trace.ts`
- Modify: `src/lib/messaging/types.ts`
- Modify: `entrypoints/background.ts:121-261`
- Test: `tests/background-dev-trace.test.ts`

**Step 1: Write the failing helper test**

Add the pure tool lifecycle test:

```ts
const trace = createToolTrace({ requestId: "read-1", tool: "read-page", now: 10 });
expect(completeToolTrace(trace, 20, {
  extractor: "readability",
  contentChars: 120,
  warnings: 0
})).toMatchObject({ status: "success", finishedAt: 20 });
```

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/background-dev-trace.test.ts
```

Expected: FAIL because the tool helpers do not exist.

**Step 3: Extend the pure helper**

Add `createToolTrace`, `completeToolTrace`, and `failToolTrace` to `background-trace.ts`. Merge only scalar safe metadata and write `finishedAt` once per completion.

**Step 4: Make runtime messages return truthful trace results**

In `background.ts`:

- `EXTRACT_ACTIVE_PAGE`: timestamp after entering handler, add `extractor`, `contentChars`, `warnings`, and `truncated` when success; add error trace on injection/content errors. Return `toolTrace` only when current settings enable Dev Mode.
- `SELECTION_ACTION`: convert the current fire-and-forget `chrome.tabs.sendMessage(...).catch(() => undefined)` into an awaited promise chain. Return `{ ok: true, toolTrace? }` only after forwarding succeeds; return `{ ok: false, toolTrace?, error }` on rejection. Return `true` from the listener to preserve asynchronous `sendResponse`.
- `OPEN_READING_COMPANION`: set `const READER_HANDOFF_TIMEOUT_MS = 10_000` near other background constants. Keep a timer handle, clear it when `READER_CONTENT_READY` matches the request, and remove `readerReady` in every completion path. On timeout send typed `LOAD_READER_ERROR` with the trace to the Reader tab when reachable.

**Step 5: Verify GREEN**

Run:

```sh
npx vitest run tests/background-dev-trace.test.ts
npm run compile
```

Expected: PASS.

**Step 7: Commit**

```sh
git add src/lib/devtools/background-trace.ts src/lib/messaging/types.ts entrypoints/background.ts tests/background-dev-trace.test.ts
git commit -m "feat: trace extension operations in developer mode"
```

---

### Task 10: Build reusable inline debug components

**Objective:** Create safe, accessible, compact renderers that all surfaces can use without copy-pasting debug UI logic.

**Files:**
- Create: `src/lib/devtools/components/DebugDetails.tsx`
- Create: `src/lib/devtools/components/ToolTraceCard.tsx`
- Test: `tests/devtools/debug-details.test.tsx`
- Test: `tests/devtools/tool-trace-card.test.tsx`

**Step 1: Write failing component tests**

`DebugDetails` tests must prove:

- collapsed summary shows `DEV_COPY.summaryPrefix`, requested thinking mode, and unavailable usage copy;
- it opens via a button with `aria-expanded`;
- reasoning becomes visible and Copy calls `navigator.clipboard.writeText` with only reasoning text;
- absent reasoning uses `DEV_COPY.thinkingNotReturned`.

`ToolTraceCard` tests must prove safe scalar fields render, status changes text/class, and `metadata` never renders an object value.

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/devtools/debug-details.test.tsx tests/devtools/tool-trace-card.test.tsx
```

Expected: FAIL because components are absent.

**Step 3: Implement `DebugDetails`**

Required props:

```ts
type DebugDetailsProps = {
  trace: AiDevTrace;
  compact?: boolean;
};
```

Implement a semantic `<section>` with a toggle `<button>`. Use a local `expanded` state initialized to `trace.thinking.state === "returned" && trace.status === "pending"`. Use `font-mono`, borders, `max-h-60 overflow-y-auto`, and existing stone/violet tokens. Do not introduce emoji, gradients, pills, or drop shadows.

For token text, use the explicit unavailable string when `trace.usage` is absent. Render safe request params with `JSON.stringify(trace.effectiveRequestParams)` only because that field is created by the allow-list in Task 8.

**Step 4: Implement `ToolTraceCard`**

Required props:

```ts
type ToolTraceCardProps = {
  trace: ToolDevTrace;
  compact?: boolean;
};
```

Iterate `Object.entries(trace.metadata)`, but render only string/number/boolean values. Do not add arbitrary metadata children. Show elapsed time only when `finishedAt` exists.

**Step 5: Verify GREEN**

Run:

```sh
npx vitest run tests/devtools/debug-details.test.tsx tests/devtools/tool-trace-card.test.tsx
npm run compile
```

Expected: PASS.

**Step 6: Commit**

```sh
git add src/lib/devtools/components/DebugDetails.tsx src/lib/devtools/components/ToolTraceCard.tsx tests/devtools/debug-details.test.tsx tests/devtools/tool-trace-card.test.tsx
git commit -m "feat: add inline developer trace components"
```

---

### Task 11: Integrate Dev Trace into Sidepanel chat and Read Page timeline

**Objective:** Replace the Sidepanel’s homogeneous message list with a typed timeline and render AI/tool traces inline.

**Files:**
- Modify: `entrypoints/sidepanel/hooks/useChatController.ts:7-172`
- Modify: `entrypoints/sidepanel/App.tsx:50-220`
- Modify: `entrypoints/sidepanel/components/ChatMessage.tsx:18-110`
- Modify: `tests/use-chat-controller.test.tsx`
- Modify: `tests/sidepanel-app.test.tsx`
- Modify: `tests/chat-message.test.tsx`

**Step 1: Write failing controller tests**

Add a developer-context send call and simulate these responses in order:

```ts
{ type: "AI_STREAM_DEBUG_START", requestId, trace }
{ type: "AI_STREAM_REASONING", requestId, delta: "Plan" }
{ type: "AI_STREAM_CHUNK", requestId, delta: "Answer" }
{ type: "AI_STREAM_DONE", requestId, trace: completedTrace }
```

Assert the resulting assistant timeline item retains content and `debug` trace. Add a non-dev test that sends only the old response variants and preserves the old message shape/behavior.

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/use-chat-controller.test.tsx tests/chat-message.test.tsx tests/sidepanel-app.test.tsx
```

Expected: FAIL because the timeline/debug fields are absent.

**Step 3: Introduce discriminated timeline types**

In the controller, replace exported `ChatItem` with:

```ts
export type ChatMessageItem = {
  kind: "message";
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  debug?: AiDevTrace;
};

export type ChatTimelineItem =
  | ChatMessageItem
  | { kind: "tool-trace"; id: string; trace: ToolDevTrace };
```

`sendPrompt` must accept optional `AiDevContext`, add it to the Port request, and update the matching assistant item on debug events. Its existing callers from selection forwarding and Read Page must keep working with omitted context.

**Step 4: Render the timeline in App**

- In the ordinary composer callback, pass `{ surface: "sidepanel", feature: "chat" }`.
- For `readPage`, create a pending `tool-trace` only when the extraction response includes a `toolTrace`, then replace it with the returned finished trace before sending the page prompt.
- Map by `item.kind`; only pass `ChatMessageItem` fields to `ChatMessage`.
- Update `saveMessage` to accept `ChatMessageItem`, never a tool trace.

**Step 5: Render trace below assistant output**

Add optional `debug?: AiDevTrace` to `ChatMessage` props. Render `<DebugDetails trace={props.debug} />` beneath assistant actions only when `debug` exists. User/system messages must never render this block.

**Step 6: Verify GREEN**

Run:

```sh
npx vitest run tests/use-chat-controller.test.tsx tests/chat-message.test.tsx tests/sidepanel-app.test.tsx
npm run compile
```

Expected: PASS.

**Step 7: Commit**

```sh
git add entrypoints/sidepanel/hooks/useChatController.ts entrypoints/sidepanel/App.tsx entrypoints/sidepanel/components/ChatMessage.tsx tests/use-chat-controller.test.tsx tests/sidepanel-app.test.tsx tests/chat-message.test.tsx
git commit -m "feat: show developer traces in sidepanel chat"
```

---

### Task 12: Render selection and AI traces in the Floating Window

**Objective:** Show the selection-operation trace and streamed AI trace inline in the in-page floating surface.

**Files:**
- Modify: `entrypoints/active-tab-agent.ts:63-74, 136-145`
- Modify: `src/lib/floating-window/FloatingWindow.tsx:64-339`
- Modify: `src/lib/floating-window/mount.ts:8-80`
- Modify: `tests/active-tab-agent.test.ts`
- Modify: `tests/floating-window.test.tsx`

**Step 1: Write failing Floating Window tests**

Render with `initialToolTrace` and `skipAiRequest: true`; assert the trace displays and `chrome.runtime.connect` is not called. Render a normal request, emit debug start/reasoning/done events through its mocked Port, and assert `DebugDetails` appears under the response. Add an active-agent test that mocks the awaited `SELECTION_ACTION` response as `{ ok: false, toolTrace }` and asserts `mountFloatingWindow` receives the trace with `skipAiRequest: true`.

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/floating-window.test.tsx
```

Expected: FAIL because those props/events are not handled.

**Step 3: Extend props and state**

Add:

```ts
initialToolTrace?: ToolDevTrace;
skipAiRequest?: boolean;
```

to both `MountOptions` and `FloatingWindow` props. Guard the existing stream `useEffect` immediately when `skipAiRequest` is true. In normal flows, send:

```ts
devContext: { surface: "floating", feature: "selection-response" }
```

Keep an `AiDevTrace | undefined` state keyed to `props.requestId`; update it for every `AI_STREAM_DEBUG_*` event; render `<DebugDetails trace={trace} />` after `FloatingChatMessage`.

Make `sendSelectionAction` async in `active-tab-agent.ts`. Await its background response; preserve the current `FORWARD_SELECTION_ACTION` success path. On `{ ok: false, toolTrace }`, call `mountFloatingWindow` with `prompt: ""`, the initial trace, and `skipAiRequest: true` so the tool error remains visible without triggering an AI request.

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/floating-window.test.tsx tests/active-tab-agent.test.ts
npm run compile
```

Expected: PASS.

**Step 5: Commit**

```sh
git add entrypoints/active-tab-agent.ts src/lib/floating-window/FloatingWindow.tsx src/lib/floating-window/mount.ts tests/active-tab-agent.test.ts tests/floating-window.test.tsx
git commit -m "feat: show developer traces in floating window"
```

---

### Task 13: Render Reader handoff and timeout traces

**Objective:** Make Reader loading finite and show the `open-reader` tool trace at the Reader surface.

**Files:**
- Modify: `entrypoints/reader/App.tsx:16-142`
- Create: `tests/reader/dev-traces.test.tsx`
- Modify: `tests/setup.ts`

**Step 1: Write failing handoff tests**

Create the test file with two independent cases:

1. `LOAD_READER_CONTENT` carrying `toolTrace` renders `ToolTraceCard` immediately below `ReaderHeader`.
2. `LOAD_READER_ERROR` exits the loading state and renders the error trace instead of the permanent “Đang tải nội dung...” screen.

Add only Chrome mock behavior needed for `runtime.onMessage` to `tests/setup.ts`.

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/reader/App.test.tsx tests/reader/dev-traces.test.tsx
```

Expected: FAIL because Reader has neither trace nor handoff-error state.

**Step 3: Add isolated Reader state**

Store the optional trace and error separately from `pageData`:

```ts
const [readerTrace, setReaderTrace] = useState<ToolDevTrace | undefined>();
const [readerError, setReaderError] = useState("");
```

Extend the existing listener:

```ts
if (msg.type === "LOAD_READER_CONTENT") {
  setReaderTrace(msg.toolTrace);
  setReaderError("");
  setPageData({ title: msg.title || "", url: msg.url || "", content: msg.content || "", excerpt: msg.excerpt || "" });
}
if (msg.type === "LOAD_READER_ERROR") {
  setReaderTrace(msg.toolTrace);
  setReaderError(msg.error);
}
```

When `readerError` exists, replace the loading screen with concise error text plus `<ToolTraceCard compact trace={readerTrace} />` when present. When `pageData` exists, render the trace immediately after `ReaderHeader`.

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/reader/App.test.tsx tests/reader/dev-traces.test.tsx
npm run compile
```

Expected: PASS.

**Step 5: Commit**

```sh
git add entrypoints/reader/App.tsx tests/reader/dev-traces.test.tsx tests/setup.ts
git commit -m "feat: show reader handoff developer trace"
```

---

### Task 14: Add Dev Trace to Reader Summary and Q&A

**Objective:** Render request-scoped AI diagnostics below the existing Reader Summary and Q&A results.

**Files:**
- Modify: `entrypoints/reader/components/SummaryTab.tsx:21-135`
- Modify: `entrypoints/reader/components/QATab.tsx:24-186`
- Modify: `tests/reader/dev-traces.test.tsx`

**Step 1: Write failing Summary/Q&A tests**

For both features, assert that the Port payload contains the exact context and a completed debug event renders `DebugDetails compact`:

```ts
devContext: { surface: "reader", feature: "reader-summary" }
// and
devContext: { surface: "reader", feature: "reader-qa" }
```

Keep a separate assertion that a content-only `AI_STREAM_CHUNK` still renders normally without debug UI.

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/reader/dev-traces.test.tsx
```

Expected: FAIL because neither component sends Dev Context or retains a trace.

**Step 3: Implement the common local state pattern**

For each component, add `const [debugTrace, setDebugTrace] = useState<AiDevTrace>();`, add the correct `devContext` to `port.postMessage`, and handle only matching-request debug events:

```ts
if (message.type === "AI_STREAM_DEBUG_START") setDebugTrace(message.trace);
if (message.type === "AI_STREAM_REASONING") setDebugTrace((trace) => trace ? appendReasoning(trace, message.delta) : trace);
if (message.type === "AI_STREAM_DEBUG_UPDATE") setDebugTrace((trace) => trace ? applyDebugUpdate(trace, message) : trace);
if (message.type === "AI_STREAM_DONE" && message.trace) setDebugTrace(message.trace);
if (message.type === "AI_STREAM_ERROR" && message.trace) setDebugTrace(message.trace);
```

Render `<DebugDetails compact trace={debugTrace} />` below the existing summary/result only when the trace exists. Do not copy `useChatController`; Reader state remains feature-local.

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/reader/dev-traces.test.tsx
npm run compile
```

Expected: PASS.

**Step 5: Commit**

```sh
git add entrypoints/reader/components/SummaryTab.tsx entrypoints/reader/components/QATab.tsx tests/reader/dev-traces.test.tsx
git commit -m "feat: show developer traces in reader summary and qa"
```

---

### Task 15: Route DefinitionPopover through the AI Port

**Objective:** Replace the isolated direct completion call so short definitions get the same trace lifecycle as other Reader AI features.

**Files:**
- Modify: `entrypoints/reader/components/DefinitionPopover.tsx:1-132`
- Modify: `tests/reader/dev-traces.test.tsx`

**Step 1: Write the failing DefinitionPopover test**

Assert that selecting a term opens `AI_STREAM_PORT`, sends:

```ts
devContext: { surface: "reader", feature: "reader-definition" }
```

and that `fetchCompletion` is not called. Simulate debug start, content chunk, and done; assert definition text and compact debug details appear. Add a cache test proving the second lookup returns cached content without fabricating a trace.

**Step 2: Confirm RED**

Run:

```sh
npx vitest run tests/reader/dev-traces.test.tsx
```

Expected: FAIL because DefinitionPopover uses `fetchCompletion` directly.

**Step 3: Replace direct completion with the existing Port lifecycle**

Delete direct imports of `fetchCompletion`, `resolveProviderRuntimeConfig`, and `getSettings`. Reuse the short system/user prompt content, but send it through `AI_STREAM_PORT`, append `AI_STREAM_CHUNK` to `definition`, maintain `portRef`, and disconnect on done/error/unmount.

Use the same trace state/update pattern from Task 14. The existing `cacheRef` remains content-only: when a cached definition is used, leave `debugTrace` undefined rather than inventing an AI trace.

**Step 4: Verify GREEN**

Run:

```sh
npx vitest run tests/reader/dev-traces.test.tsx
npm run compile
```

Expected: PASS.

**Step 5: Commit**

```sh
git add entrypoints/reader/components/DefinitionPopover.tsx tests/reader/dev-traces.test.tsx
git commit -m "feat: trace reader definitions through AI port"
```

---

### Task 16: Run complete regression and inspect the production bundle

**Objective:** Verify that Dev Mode adds no type, unit-test, or WXT production build regression.

**Files:**
- No source changes expected.

**Step 1: Run focused Dev Mode suite**

```sh
npx vitest run tests/devtools tests/background-dev-trace.test.ts tests/reader/dev-traces.test.tsx tests/use-chat-controller.test.tsx tests/sidepanel-app.test.tsx tests/floating-window.test.tsx tests/sidepanel-settings.test.tsx
```

Expected: PASS.

**Step 2: Run full typecheck and full suite**

```sh
npm run compile
npx vitest run
```

Expected: both commands exit `0`; existing 105 baseline tests plus new coverage pass.

**Step 3: Build the Chrome MV3 artifact**

```sh
npm run build
```

Expected: WXT completes successfully and writes `.output/chrome-mv3/`.

**Step 4: Inspect changed files before final delivery**

```sh
git status --short
git diff --check main...HEAD
git log --oneline main..HEAD
```

Expected: only Dev Mode implementation commits and ignored build artifacts; no whitespace errors.

**Step 5: Commit only if a final corrective edit was necessary**

```sh
git add <corrected-files>
git commit -m "fix: complete dev mode trace verification"
```

If no source/docs changed during verification, do not create an empty commit.
