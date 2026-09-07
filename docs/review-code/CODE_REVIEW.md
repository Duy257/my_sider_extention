# Code Review Report - Personal AI Sidebar

**Project**: Personal AI Sidebar (Chrome Manifest V3 Browser Extension)
**Review Date**: 2026-09-02
**Reviewer**: AI Code Review

---

## 📋 Executive Summary

This is a well-architected browser extension built with WXT + React 19 + TypeScript. The project uses discriminated unions for error handling, versioned storage migrations, and Port-based communication. Overall code quality is high, but there are several type safety, security, and potential runtime issues that need attention.

---

## 🔴 Critical Issues

### 1. `any` Type Abuse Breaking Type Safety

**File**: `src/core/ai/client.ts`
**Location**: Lines 330, 386, 444

```typescript
// Line 330 - fetchCompletion function
let body: any;
try {
  body = await response.json();
} catch {
  return { ok: false, error: "Provider returned a non-JSON response." };
}

// Line 386 - testConnection function
let body: any;
try {
  body = await response.json();
} catch { ... }

// Line 444 - fetchModels function
let body: any;
try {
  body = await response.json();
} catch { ... }
```

**Problem**:
- Using `any` bypasses TypeScript type checking
- Subsequent code uses optional chaining `body?.choices?.[0]?.message` but without complete type safety guarantees
- If the provider returns an unexpected structure, error messages aren't specific enough

**Fix Suggestion**:

```typescript
// Define response type interfaces
interface CompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface ModelsResponse {
  data?: Array<{ id?: unknown }>;
  error?: {
    message?: string;
  };
}

interface TestConnectionResponse {
  choices?: unknown[];
  error?: {
    message?: string;
  };
}

// Use generics to ensure type safety
async function fetchCompletion(input: {...})
  : Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  try {
    const response = await fetchWithTimeout(...);
    if (!response.ok) { ... }

    const body = await response.json() as CompletionResponse;

    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return { ok: false, error: "Provider returned an unexpected response format." };
    }
    return { ok: true, content };
  } catch (error) {
    ...
  }
}
```

---

### 2. XSS Security Risk - Insufficient `dangerouslySetInnerHTML` Protection

**File**: `entrypoints/reader/components/ReaderView.tsx`
**Location**: Lines 1-15, 78

```typescript
function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const div = doc.body.firstElementChild as HTMLElement | null;
  if (!div) return html;
  div.querySelectorAll('*').forEach((el) => {
    for (const attr of el.attributes) {
      if (attr.name.startsWith('on')) {  // Only removes on* events
        el.removeAttribute(attr.name);
      }
    }
  });
  return div.innerHTML;
}
```

**Problem**:
- `sanitizeHtml` only removes `on*` event handlers
- Multiple XSS vectors are not filtered:
  - `javascript:` URLs (href, src, data, action, etc.)
  - `<meta http-equiv="refresh">` redirects
  - CSS `expression()` (legacy IE)
  - SVG inline scripts
  - `<body onload>` alternatives

**Fix Suggestion**:

Use a proven HTML sanitization library (recommend DOMPurify):

```typescript
// Install: npm install isomorphic-dompurify
import DOMPurify from 'isomorphic-dompurify';

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'figure', 'figcaption'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'object', 'embed'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'onmouseover'],
  });
}
```

---

### 3. Memory Leak - Event Listeners Not Properly Cleaned

**File**: `entrypoints/reader/components/CompanionPanel.tsx`
**Location**: Lines 19-27

```typescript
useEffect(() => {
  function handler(e: CustomEvent) {
    setActiveTab("qa");
    setPrefillQuestion(e.detail);
  }
  window.addEventListener("reader-ask-more" as any, handler as any);
  return () => window.removeEventListener("reader-ask-more" as any, handler as any);
}, []);
```

**Problem**:
- Using `as any` type assertions hides type errors
- Event name `"reader-ask-more"` is not defined as a constant, risking typos
- If CustomEvent isn't dispatched correctly, errors are hard to trace

**Fix Suggestion**:

```typescript
// In constants.ts
export const READER_ASK_MORE_EVENT = 'reader-ask-more';

// Use type-safe event helper functions
function dispatchReaderAskMore(detail: string) {
  window.dispatchEvent(new CustomEvent<string>(READER_ASK_MORE_EVENT, { detail }));
}

// In component
useEffect(() => {
  function handler(e: CustomEvent<string>) {
    setActiveTab("qa");
    setPrefillQuestion(e.detail);
  }
  window.addEventListener(READER_ASK_MORE_EVENT, handler);
  return () => window.removeEventListener(READER_ASK_MORE_EVENT, handler);
}, []);
```

---

## 🟠 High Risk Issues

### 4. Race Condition - Settings Cache Invalidation May Cause Config Desync

**File**: `entrypoints/background.ts`
**Location**: Lines 7-21

```typescript
let settingsCache: { settings: Settings; timestamp: number } | null = null;
const SETTINGS_CACHE_TTL = 5_000; // 5 seconds

async function getCachedSettings(): Promise<Settings> {
  const now = Date.now();
  if (settingsCache && (now - settingsCache.timestamp) < SETTINGS_CACHE_TTL) {
    return settingsCache.settings;
  }
  const settings = await getSettings();
  settingsCache = { settings, timestamp: now };
  return settings;
}
```

**Problem**:
- Cache TTL is 5 seconds, but cache is directly invalidated in `SETTINGS_UPDATED` message handling
- If multiple requests occur simultaneously, brief inconsistencies may occur
- `settingsCache` is a module-level variable and may hold stale data across different extension lifecycles

**Fix Suggestion**:

```typescript
// Option 1: Event-driven cache invalidation
const cacheInvalidator = {
  invalidate: () => { settingsCache = null; }
};

// In SETTINGS_UPDATED handler
if (message.type === "SETTINGS_UPDATED") {
  cacheInvalidator.invalidate();
  sendResponse({ ok: true });
  return true;
}

// Option 2: Use chrome.storage.onChanged listener
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && 'settings' in changes) {
    settingsCache = null;
  }
});
```

---

### 5. Potential Data Loss - Silent Fail Storage Pattern

**File**: `src/core/storage/index.ts`
**Location**: Lines 17-24, 93-100

```typescript
async function setLocal<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch {
    // silently fail
  }
}

export async function saveSavedResults(results: SavedResult[]): Promise<void> {
  try {
    await setLocal(SAVED_RESULTS_KEY, { schemaVersion: CURRENT_SCHEMA_VERSION, data: results });
  } catch (error) {
    console.error("saveSavedResults failed:", error); // Only logs error
    return [];  // Returns empty array but data is lost
  }
}
```

**Problem**:
- `setLocal` fails silently, user has no idea data wasn't saved
- `saveSavedResults` catch block logs error but returns empty array, causing caller to think operation succeeded
- If storage is full or quota exceeded, user loses unsaved data

**Fix Suggestion**:

```typescript
// Introduce error type
export type StorageResult =
  | { ok: true }
  | { ok: false; error: string };

async function setLocal<T>(key: string, value: T): Promise<StorageResult> {
  try {
    await chrome.storage.local.set({ [key]: value });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage error";
    console.error(`Failed to save ${key}:`, error);
    return { ok: false, error: message };
  }
}

export async function saveSavedResults(results: SavedResult[]): Promise<StorageResult> {
  const envelope = { schemaVersion: CURRENT_SCHEMA_VERSION, data: results };
  return await setLocal(SAVED_RESULTS_KEY, envelope);
}

// Handle result at call site
async function handleSave() {
  const result = await saveSavedResults(updatedResults);
  if (!result.ok) {
    setSaveStatus("error");
    showError(`Save failed: ${result.error}`);
  }
}
```

---

### 6. Type Assertions Mask Runtime Errors

**File**: `entrypoints/reader/App.tsx`
**Location**: Line 33

```typescript
function handleMessage(msg: any) {
  if (msg.type === "LOAD_READER_CONTENT" && msg.requestId === requestId) {
    setPageData({
      title: msg.title || "",
      url: msg.url || "",
      content: msg.content || "",
      excerpt: msg.excerpt || "",
    });
```

**Problem**:
- `msg: any` type assertion bypasses TypeScript checks
- If `msg.title` and other fields have incorrect types, runtime errors may occur
- No validation that required fields exist

**Fix Suggestion**:

```typescript
// Define message types
interface LoadReaderContentMessage {
  type: "LOAD_READER_CONTENT";
  requestId: string;
  title?: string;
  url?: string;
  content?: string;
  excerpt?: string;
  toolTrace?: ToolDevTrace;
}

interface LoadReaderErrorMessage {
  type: "LOAD_READER_ERROR";
  requestId: string;
  error?: string;
  toolTrace?: ToolDevTrace;
}

type ReaderAppMessage = LoadReaderContentMessage | LoadReaderErrorMessage;

function handleMessage(msg: unknown) {
  if (!isReaderAppMessage(msg)) return;

  if (msg.type === "LOAD_READER_CONTENT" && msg.requestId === requestId) {
    setPageData({
      title: msg.title ?? "",
      url: msg.url ?? "",
      content: msg.content ?? "",
      excerpt: msg.excerpt ?? "",
    });
    ...
  }
}

function isReaderAppMessage(msg: unknown): msg is ReaderAppMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const obj = msg as Record<string, unknown>;
  return typeof obj.type === "string" &&
         ["LOAD_READER_CONTENT", "LOAD_READER_ERROR"].includes(obj.type);
}
```

---

### 7. Floating Window Destruction May Lose Unsaved Data

**File**: `src/scripts/floating-mount.ts`
**Location**: Lines 148-161

```typescript
export function destroyFloatingWindow() {
  if (currentRoot) {
    try {
      currentRoot.unmount();
    } catch (e) {
      console.warn("Error unmounting floating window root:", e);
    }
    currentRoot = null;
  }
  if (currentContainer) {
    try {
      currentContainer.remove();
    } catch (e) {
      console.warn("Error removing floating window container:", e);
    }
    currentContainer = null;
  }
}
```

**Problem**:
- `destroyFloatingWindow` doesn't provide a callback or Promise
- If user destroys floating window before AI response completes, in-progress request state may be lost
- No confirmation mechanism to prevent accidental close

**Fix Suggestion**:

```typescript
// Add optional completion callback
export interface MountOptions {
  position: { top: number; left: number };
  prompt: string;
  requestId: string;
  title: string;
  toolTrace?: ToolDevTrace;
  onDestroy?: () => void;  // New
}

export function destroyFloatingWindow() {
  const container = currentContainer;

  if (currentRoot) {
    try {
      currentRoot.unmount();
    } catch (e) {
      console.warn("Error unmounting floating window root:", e);
    }
    currentRoot = null;
  }

  if (container) {
    try {
      container.remove();
    } catch (e) {
      console.warn("Error removing floating window container:", e);
    }
    currentContainer = null;
  }

  // Notify component about to be destroyed
  onDestroyCallback?.();
}

// In FloatingWindow, handle destruction
function FloatingWindow({ onClose, onDestroy }: Props) {
  useEffect(() => {
    return () => {
      // Try to save draft or cancel request
      onDestroy?.();
    };
  }, [onDestroy]);
}
```

---

## 🟡 Medium Issues

### 8. Code Duplication - Stream Processing Logic Scattered

**Related Files**:
- `entrypoints/sidepanel/hooks/useChatController.ts`
- `entrypoints/reader/components/SummaryTab.tsx`
- `entrypoints/reader/components/QATab.tsx`
- `src/components/floating-window/FloatingWindow.tsx`

**Problem**:
- Streaming response handling logic is duplicated across multiple files
- Buffer flushing, error handling, and cancellation logic is scattered
- Difficult to modify and test uniformly

**Fix Suggestion**:

Extract shared streaming hook:

```typescript
// src/hooks/useStreamingChat.ts
export function useStreamingChat(options: StreamingOptions) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string>("");

  // Unified stream handling logic
  const handleStreamMessage = useCallback((message: AiPortResponse) => {
    // Unified handling logic
  }, []);

  return { messages, streaming, error, handleStreamMessage, ... };
}
```

---

### 9. Magic Numbers Should Be Extracted to Named Constants

**Scattered Locations**:

```typescript
// storage/index.ts
const SETTINGS_KEY = "settings";
const PROMPTS_KEY = "promptTemplates";
const SAVED_RESULTS_KEY = "savedResults";

// selection/toolbar.ts
const MIN_SELECTION_CHARS = 3;
const MAX_SELECTION_CHARS = 20000;

// extraction/index.ts
const MAX_PAGE_CONTEXT_CHARS = 40000;

// background.ts
const SETTINGS_CACHE_TTL = 5_000;
const READER_HANDOFF_TIMEOUT_MS = 10_000;

// ai/client.ts
const REQUEST_TIMEOUT = 20_000;
const FIRST_TOKEN_TIMEOUT = 30_000;

// prompts/builders.ts
const MAX_CHAT_HISTORY_MESSAGES = 12;
```

**Fix Suggestion**:

Create `src/constants/index.ts`:

```typescript
// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: "settings",
  PROMPTS: "promptTemplates",
  SAVED_RESULTS: "savedResults",
} as const;

// Selection constraints
export const SELECTION_LIMITS = {
  MIN_CHARS: 3,
  MAX_CHARS: 20_000,
  DEBOUNCE_MS: 150,
} as const;

// Extraction limits
export const EXTRACTION_LIMITS = {
  MAX_CONTEXT_CHARS: 40_000,
} as const;

// Timeouts (ms)
export const TIMEOUTS = {
  SETTINGS_CACHE: 5_000,
  READER_HANDOFF: 10_000,
  REQUEST: 20_000,
  FIRST_TOKEN: 30_000,
} as const;

// Chat settings
export const CHAT_SETTINGS = {
  MAX_HISTORY_MESSAGES: 12,
  ERROR_DISMISS_MS: 8_000,
  STREAM_FLUSH_MS: 100,
} as const;
```

---

### 10. Migration Logic May Lose Data

**File**: `src/core/storage/migrations.ts`
**Location**: Lines 98-100

```typescript
if (envelope.schemaVersion !== schemaVersion) {
  return { schemaVersion, data: envelope.data };  // Directly discards old version data
}
```

**Problem**:
- Current migration logic only handles version number changes, doesn't perform actual data migration
- If schema version doesn't match, directly returns `envelope.data` without transformation
- Old version data may contain unnecessary fields for new version, but missing fields cause problems

**Fix Suggestion**:

Implement proper version migration:

```typescript
const MIGRATIONS: Record<number, (data: unknown) => unknown> = {
  1: (data) => migrateV1toV2(data),
  2: (data) => migrateV2toV3(data),
  3: (data) => migrateV3toV4(data),
  4: (data) => migrateV4toV5(data),
  // Add new migration functions
};

export function migrateStorageEnvelope<T>(
  value: T | StorageEnvelope<T> | undefined,
  targetVersion: number,
  fallbackData?: T
): StorageEnvelope<T> {
  if (value === undefined) {
    if (fallbackData === undefined) {
      throw new Error("Cannot migrate undefined storage value without fallback data.");
    }
    return { schemaVersion: targetVersion, data: fallbackData };
  }

  const envelope = value as StorageEnvelope<T>;

  // Already at latest version
  if (envelope.schemaVersion === targetVersion) {
    return envelope;
  }

  // Gradually migrate from current version to target version
  let currentData = envelope.data;
  for (let v = envelope.schemaVersion; v < targetVersion; v++) {
    const migration = MIGRATIONS[v];
    if (migration) {
      currentData = migration(currentData);
    }
  }

  return { schemaVersion: targetVersion, data: currentData as T };
}
```

---

### 11. Missing Boundary Checks May Cause Array Out of Bounds

**File**: `entrypoints/sidepanel/App.tsx`
**Location**: Line 159

```typescript
const last = chat.messages[chat.messages.length - 1];
return chat.streaming && chat.messages.length > 0 && last?.kind === "message" && last.content === "" ? (
  <TypingIndicator phase={chat.streamingPhase} />
) : null;
```

**Problem**:
- Accessing `chat.messages[chat.messages.length - 1]` after checking `length > 0`, but readability is poor
- If messages array is modified between check and access (unlikely but theoretically possible), could cause issues

**Fix Suggestion**:

```typescript
const lastMessage = chat.messages.at(-1);
const showTypingIndicator = chat.streaming &&
                             chat.messages.length > 0 &&
                             lastMessage?.kind === "message" &&
                             lastMessage.content === "";

return showTypingIndicator ? (
  <TypingIndicator phase={chat.streamingPhase} />
) : null;
```

---

## 🟢 Low Issues

### 12. API Key Security Notice Insufficient

**File**: `entrypoints/sidepanel/components/SettingsPanel.tsx`
**Location**: Lines 215-217

```typescript
<span className="leading-relaxed">
  Khóa API được lưu trữ cục bộ trong bộ nhớ ẩn Chrome.
  Đây là phiên bản thử nghiệm, thông tin chưa được mã hóa nâng cao.
</span>
```

**Problem**:
- Security notice is in Vietnamese, inconsistent with project UI
- Notice not specific enough, user doesn't understand specific risks

**Fix Suggestion**:

```typescript
// Improved security notice
<span className="leading-relaxed">
  API keys are stored locally in browser storage.
  <strong> Risks: </strong> Data may be accessed by:
  same-machine users, other extensions, or when browser data is backed up/synced.
</span>

// Consider adding "Clear all data" option
<button onClick={handleClearAllData} className="text-red-400">
  Clear all data
</button>
```

---

### 13. Missing API Key Format Validation

**File**: `entrypoints/sidepanel/components/SettingsPanel.tsx`
**Location**: Lines 93-99

```typescript
async function updateApiKey(value: string) {
  setLocalApiKey(value);
  const nextKeys = { ...props.settings.apiKeys };
  if (value.trim()) nextKeys[providerId] = value;
  else delete nextKeys[providerId];
  await commit(createNextSettings({ apiKeys: nextKeys }));
}
```

**Problem**:
- No API Key format validation
- User may enter invalid key causing subsequent request failures
- No immediate feedback

**Fix Suggestion**:

```typescript
function isValidApiKeyFormat(key: string, providerId: string): boolean {
  if (!key.trim()) return true; // Skip empty values

  switch (providerId) {
    case "openai":
      return /^sk-[A-Za-z0-9_-]{20,}$/.test(key);
    case "opencode":
      return key.length >= 20;
    default:
      return key.length >= 10;
  }
}

async function updateApiKey(value: string) {
  const trimmed = value.trim();

  if (trimmed && !isValidApiKeyFormat(trimmed, providerId)) {
    setApiKeyError("Invalid API key format.");
    return;
  }

  setLocalApiKey(value);
  setApiKeyError(null);

  const nextKeys = { ...props.settings.apiKeys };
  if (trimmed) nextKeys[providerId] = trimmed;
  else delete nextKeys[providerId];

  await commit(createNextSettings({ apiKeys: nextKeys }));
}
```

---

### 14. DevTools Tracing Wastes Resources in Production

**File**: `entrypoints/background.ts`
**Location**: Lines 100-110

```typescript
if (runtime.config.devMode && message.devContext) {
  const trace = createAiTrace({
    requestId: message.requestId,
    context: message.devContext,
    runtime: runtime.config,
    thinkingMode,
    extraBodyParams,
    now: Date.now()
  });
  emitter = createAiPortTraceEmitter({
    trace,
    send,
    now: Date.now
  });
}
```

**Problem**:
- Dev trace objects not created when devMode=false, but function calls still exist
- `now: Date.now` passes function reference instead of current time, may cause inconsistency

**Fix Suggestion**:

```typescript
// Ensure devMode check is outermost
const shouldTrack = runtime.config.devMode && message.devContext;

if (shouldTrack) {
  const trace = createAiTrace({
    requestId: message.requestId,
    context: message.devContext,
    runtime: runtime.config,
    thinkingMode,
    extraBodyParams,
    now: Date.now()  // Pass actual timestamp
  });
  emitter = createAiPortTraceEmitter({
    trace,
    send,
    now: Date.now
  });
}

// Or use early return
if (!runtime.config.devMode || !message.devContext) {
  // Standard flow handling
  ...
}
```

---

### 15. Selection Toolbar Button SVG Not Validated

**File**: `src/core/selection/actions.ts`

**Problem**:
- If SVG data is invalid or contains malicious code, may cause rendering issues
- No sanitization of SVG content

**Fix Suggestion**:

```typescript
// actions.ts
export interface SelectionActionDef {
  action: SelectionAction;
  label: string;
  iconSvg: string;  // Should be validated SVG string
}

// When building toolbar, validate
function sanitizeSvg(svg: string): string {
  // Remove all event handlers
  return svg.replace(/\s*on\w+="[^"]*"/gi, '');
}

button.innerHTML = sanitizeSvg(item.iconSvg);
```

---

## 📊 Issue Statistics

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 3 | Needs immediate fix |
| 🟠 High | 4 | Fix soon |
| 🟡 Medium | 4 | Plan to fix |
| 🟢 Low | 5 | Suggest fixing |

---

## ✅ Best Practice Recommendations

### 1. Add Runtime Type Validation

```typescript
// Use zod or io-ts for runtime validation
import { z } from "zod";

const SettingsSchema = z.object({
  providerId: z.string(),
  apiKeys: z.record(z.string(), z.string()),
  selectedModels: z.record(z.string(), z.string()),
  thinkingMode: z.enum(["off", "low", "medium", "high", "max"]),
  devMode: z.boolean(),
});

export function validateSettings(data: unknown): Settings | null {
  const result = SettingsSchema.safeParse(data);
  return result.success ? result.data : null;
}
```

### 2. Add Integration Tests

```typescript
// tests/integration/chat-flow.test.ts
describe("Chat flow integration", () => {
  it("should complete a full chat roundtrip", async () => {
    // 1. Set up test API
    // 2. Send message
    // 3. Verify response
    // 4. Cleanup
  });
});
```

### 3. Add Performance Monitoring

```typescript
// Add metrics collection similar to WebVitals
const metrics = {
  streamLatency: [],
  renderTime: [],
  storageLatency: [],
};

export function recordMetric(name: keyof typeof metrics, value: number) {
  metrics[name].push({ value, timestamp: Date.now() });
}
```

---

## 📝 Fix Priority

### P0 - Must Fix (Security/Data Impact)
1. XSS Security Risk (#2)
2. Silent Fail Storage (#5)

### P1 - Fix Soon (Stability Impact)
1. `any` Type Abuse (#1)
2. Memory Leak Risk (#3)
3. Settings Cache Race (#4)
4. Type Assertion Hides Errors (#6)

### P2 - Plan to Fix (Code Quality)
1. Duplicate Code Extraction (#8)
2. Magic Numbers Constants (#9)
3. Migration Logic Improvement (#10)

### P3 - Suggest Fixing (Improvements)
1. Security Notice Optimization (#12)
2. API Key Validation (#13)
3. DevTools Resource Optimization (#14)

---

*Report generated: 2026-09-02*
