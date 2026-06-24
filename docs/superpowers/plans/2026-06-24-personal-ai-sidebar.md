# Personal AI Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private Chrome/Chromium Manifest V3 extension that provides a chat-first AI side panel, OpenAI BYOK streaming, reader-mode page extraction, floating selection actions, prompt template CRUD, and saved AI results.

**Architecture:** Use WXT entrypoints for `sidepanel`, `background`, and an injected active-tab content agent. Shared TypeScript modules under `src/lib` own storage, model config, prompts, extraction, messaging, OpenAI streaming, and saved results. The background service worker owns active-tab resolution, content-script injection, API key access, and streaming orchestration; content scripts never receive the API key.

**Tech Stack:** WXT, React, TypeScript, Tailwind CSS, Vitest, Testing Library, Mozilla Readability, Chrome Manifest V3, OpenAI Responses API streaming.

---

## Source Notes

- Product spec: `docs/superpowers/specs/2026-06-24-personal-ai-sidebar-design.md`
- Initial product notes: `docs/docs-init.md`
- OpenAI model docs checked on 2026-06-24: `https://platform.openai.com/docs/models`
- OpenAI streaming docs checked on 2026-06-24: `https://platform.openai.com/docs/guides/streaming-responses`
- WXT content-script docs checked on 2026-06-24: `https://wxt.dev/guide/essentials/content-scripts.html`

Use these model presets unless official docs change before implementation:

```ts
export const OPENAI_MODEL_PRESETS = [
  { id: "gpt-5.5", label: "GPT-5.5", description: "Best for complex reasoning and high-quality work." },
  { id: "gpt-5.4", label: "GPT-5.4", description: "General flagship model." },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini", description: "Fast and cost-conscious default." },
  { id: "gpt-5.4-nano", label: "GPT-5.4 nano", description: "Lowest latency for short tasks." }
] as const;
```

Default model for the private MVP: `gpt-5.4-mini`.

## Repository State

Current workspace contains documentation only:

```text
docs/docs-init.md
docs/superpowers/specs/2026-06-24-personal-ai-sidebar-design.md
```

The workspace is not currently a git repository. Task 1 initializes git before scaffold work so later plan steps can commit incrementally.

## File Structure

Create this structure:

```text
package.json
tsconfig.json
vitest.config.ts
wxt.config.ts
tailwind.config.ts
postcss.config.js
entrypoints/
  active-tab-agent.ts
  background.ts
  sidepanel.html
  sidepanel/
    App.tsx
    main.tsx
    styles.css
    components/
      ChatComposer.tsx
      ChatMessage.tsx
      HeaderBar.tsx
      PromptManager.tsx
      SavedResults.tsx
      SettingsPanel.tsx
src/
  lib/
    ai/
      models.ts
      openai.ts
      stream.ts
      types.ts
    extraction/
      fallback.ts
      index.ts
      readability.ts
      types.ts
    messaging/
      index.ts
      ports.ts
      types.ts
    prompts/
      builders.ts
      seeds.ts
      types.ts
    saved-results/
      index.ts
      types.ts
    storage/
      defaults.ts
      index.ts
      migrations.ts
      types.ts
    selection/
      actions.ts
      toolbar.ts
      types.ts
tests/
  extraction/
    extraction.test.ts
  prompts/
    builders.test.ts
  storage/
    storage.test.ts
  ai/
    stream.test.ts
  selection/
    toolbar.test.ts
```

Responsibility boundaries:

- `entrypoints/background.ts`: Chrome runtime listeners, active-tab injection, pending selection request queue, OpenAI streaming.
- `entrypoints/active-tab-agent.ts`: WXT unlisted script injected with `chrome.scripting.executeScript` after explicit user action; bootstraps the tab agent and delegates selection/extraction work to `src/lib`.
- `entrypoints/sidepanel`: React UI only; no direct OpenAI API key access outside calling storage helpers.
- `src/lib/storage`: schema-versioned `chrome.storage.local` wrapper with defaults and migrations.
- `src/lib/prompts`: seed prompts and prompt builders for chat, page, and selection flows.
- `src/lib/extraction`: page extraction behind one typed interface.
- `src/lib/ai`: model presets, OpenAI request types, streaming parser, error mapping.
- `src/lib/messaging`: message and port contracts shared across entrypoints.
- `src/lib/selection`: selection action definitions and toolbar DOM utilities.

## Task 1: Initialize Repository and Scaffold WXT

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `wxt.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `entrypoints/background.ts`
- Create: `entrypoints/active-tab-agent.ts`
- Create: `entrypoints/sidepanel.html`
- Create: `entrypoints/sidepanel/main.tsx`
- Create: `entrypoints/sidepanel/App.tsx`
- Create: `entrypoints/sidepanel/styles.css`

- [ ] **Step 1: Initialize git**

Run:

```powershell
git init
```

Expected: git prints that it initialized an empty repository.

- [ ] **Step 2: Scaffold the WXT React TypeScript project**

Run with network access:

```powershell
npm create wxt@latest . -- --template react
```

Expected: WXT creates a React extension scaffold in the current directory. If npm refuses because the directory is not empty, create a temporary WXT app in `C:\tmp\my-sider-wxt-scaffold`, copy the generated config and entrypoint patterns into this workspace, and keep existing `docs/` files untouched.

- [ ] **Step 3: Install runtime and test dependencies**

Run with network access:

```powershell
npm install @mozilla/readability @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom vitest
```

Expected: dependencies are added to `package.json`.

- [ ] **Step 4: Configure WXT manifest**

Set `wxt.config.ts` to:

```ts
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Personal AI Sidebar",
    description: "Private AI sidebar for reading, rewriting, summarizing, and analysis workflows.",
    version: "0.1.0",
    permissions: ["storage", "activeTab", "sidePanel", "scripting"],
    host_permissions: ["https://api.openai.com/*"],
    side_panel: {
      default_path: "sidepanel.html"
    },
    action: {
      default_title: "Open Personal AI Sidebar"
    }
  }
});
```

- [ ] **Step 5: Configure Vitest**

Set `vitest.config.ts` to:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  }
});
```

Create `tests/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Create minimal entrypoints**

Set `entrypoints/background.ts` to:

```ts
export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });
});
```

Set `entrypoints/active-tab-agent.ts` to:

```ts
export default defineUnlistedScript(() => {
  window.dispatchEvent(new CustomEvent("personal-ai-sidebar:agent-ready"));
});
```

Set `entrypoints/sidepanel.html` to:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Personal AI Sidebar</title>
    <script type="module" src="/entrypoints/sidepanel/main.tsx"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

Set `entrypoints/sidepanel/main.tsx` to:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Set `entrypoints/sidepanel/App.tsx` to:

```tsx
export default function App() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold">Personal AI Sidebar</h1>
      </header>
      <section className="p-4 text-sm text-zinc-300">Ready.</section>
    </main>
  );
}
```

Set `entrypoints/sidepanel/styles.css` to:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
}
```

- [ ] **Step 7: Run scaffold verification**

Run:

```powershell
npm test -- --run
npm run build
```

Expected: Vitest exits with no test files or passing setup, and WXT build exits 0.

- [ ] **Step 8: Commit scaffold**

Run:

```powershell
git add package.json package-lock.json tsconfig.json vitest.config.ts wxt.config.ts tailwind.config.ts postcss.config.js entrypoints tests docs
git commit -m "chore: scaffold personal ai sidebar extension"
```

Expected: commit succeeds.

## Task 2: Storage Schema, Defaults, and Prompt Seeds

**Files:**
- Create: `src/lib/storage/types.ts`
- Create: `src/lib/storage/defaults.ts`
- Create: `src/lib/storage/migrations.ts`
- Create: `src/lib/storage/index.ts`
- Create: `src/lib/prompts/types.ts`
- Create: `src/lib/prompts/seeds.ts`
- Test: `tests/storage/storage.test.ts`

- [ ] **Step 1: Write failing storage tests**

Create `tests/storage/storage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultSettings, createInitialPromptTemplates } from "../../src/lib/storage/defaults";
import { migrateStorageEnvelope } from "../../src/lib/storage/migrations";

describe("storage defaults", () => {
  it("creates OpenAI settings with gpt-5.4-mini as default preset", () => {
    const settings = createDefaultSettings("2026-06-24T00:00:00.000Z");

    expect(settings.provider).toBe("openai");
    expect(settings.modelPreset).toBe("gpt-5.4-mini");
    expect(settings.customModel).toBe("");
    expect(settings.defaultLanguage).toBe("vi");
    expect(settings.updatedAt).toBe("2026-06-24T00:00:00.000Z");
  });

  it("seeds five prompt templates with stable sort order", () => {
    const prompts = createInitialPromptTemplates("2026-06-24T00:00:00.000Z");

    expect(prompts).toHaveLength(5);
    expect(prompts.map((prompt) => prompt.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(prompts[0].name).toBe("CEO rewrite");
    expect(prompts[4].category).toBe("dev");
  });

  it("wraps legacy data in a schema envelope", () => {
    const migrated = migrateStorageEnvelope({ provider: "openai" }, 1);

    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.data).toEqual({ provider: "openai" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- --run tests/storage/storage.test.ts
```

Expected: FAIL because `src/lib/storage/defaults` and `src/lib/storage/migrations` do not exist.

- [ ] **Step 3: Implement storage and prompt types**

Create `src/lib/prompts/types.ts`:

```ts
export type PromptCategory =
  | "general"
  | "ceo"
  | "dev"
  | "legal"
  | "sales"
  | "marketing"
  | "custom";

export type PromptTemplate = {
  id: string;
  name: string;
  instruction: string;
  category: PromptCategory;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
```

Create `src/lib/storage/types.ts`:

```ts
import type { PromptTemplate } from "../prompts/types";

export type AiProvider = "openai";

export type Settings = {
  provider: AiProvider;
  openaiApiKey?: string;
  modelPreset?: string;
  customModel?: string;
  defaultLanguage: "vi" | "en";
  updatedAt: string;
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

Create `src/lib/prompts/seeds.ts`:

```ts
import type { PromptTemplate } from "./types";

export function createSeedPromptTemplates(now: string): PromptTemplate[] {
  return [
    {
      id: "seed-ceo-rewrite",
      name: "CEO rewrite",
      instruction: "Rewrite in CEO style: clear, firm, no exaggeration.",
      category: "ceo",
      sortOrder: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-problem-cause-solution",
      name: "Problem Cause Solution",
      instruction: "Summarize as table: Problem - Cause - Solution.",
      category: "general",
      sortOrder: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-operations-analysis",
      name: "Operations analysis",
      instruction: "Analyze from a business operations perspective.",
      category: "ceo",
      sortOrder: 2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-action-plan",
      name: "Action plan",
      instruction: "Turn this content into an action plan.",
      category: "general",
      sortOrder: 3,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "seed-senior-dev-review",
      name: "Senior dev review",
      instruction: "Review technical errors as a senior developer.",
      category: "dev",
      sortOrder: 4,
      createdAt: now,
      updatedAt: now
    }
  ];
}
```

Create `src/lib/storage/defaults.ts`:

```ts
import { createSeedPromptTemplates } from "../prompts/seeds";
import type { Settings } from "./types";

export function createDefaultSettings(now = new Date().toISOString()): Settings {
  return {
    provider: "openai",
    openaiApiKey: "",
    modelPreset: "gpt-5.4-mini",
    customModel: "",
    defaultLanguage: "vi",
    updatedAt: now
  };
}

export function createInitialPromptTemplates(now = new Date().toISOString()) {
  return createSeedPromptTemplates(now);
}
```

Create `src/lib/storage/migrations.ts`:

```ts
import type { StorageEnvelope } from "./types";

export const CURRENT_SCHEMA_VERSION = 1;

export function migrateStorageEnvelope<T>(
  value: T | StorageEnvelope<T> | undefined,
  schemaVersion = CURRENT_SCHEMA_VERSION,
  fallbackData?: T
): StorageEnvelope<T> {
  if (value && typeof value === "object" && "schemaVersion" in value && "data" in value) {
    return value as StorageEnvelope<T>;
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

Create `src/lib/storage/index.ts`:

```ts
import { createDefaultSettings, createInitialPromptTemplates } from "./defaults";
import { CURRENT_SCHEMA_VERSION, migrateStorageEnvelope } from "./migrations";
import type { SavedResult, Settings, StorageEnvelope } from "./types";
import type { PromptTemplate } from "../prompts/types";

const SETTINGS_KEY = "settings";
const PROMPTS_KEY = "promptTemplates";
const SAVED_RESULTS_KEY = "savedResults";

async function getLocal<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

async function setLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<Settings> {
  const fallback = createDefaultSettings();
  const stored = await getLocal<StorageEnvelope<Settings> | Settings>(SETTINGS_KEY);
  const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, fallback);
  await setLocal(SETTINGS_KEY, envelope);
  return envelope.data;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setLocal(SETTINGS_KEY, { schemaVersion: CURRENT_SCHEMA_VERSION, data: settings });
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  const fallback = createInitialPromptTemplates();
  const stored = await getLocal<StorageEnvelope<PromptTemplate[]> | PromptTemplate[]>(PROMPTS_KEY);
  const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, fallback);
  await setLocal(PROMPTS_KEY, envelope);
  return envelope.data;
}

export async function savePromptTemplates(prompts: PromptTemplate[]): Promise<void> {
  await setLocal(PROMPTS_KEY, { schemaVersion: CURRENT_SCHEMA_VERSION, data: prompts });
}

export async function getSavedResults(): Promise<SavedResult[]> {
  const stored = await getLocal<StorageEnvelope<SavedResult[]> | SavedResult[]>(SAVED_RESULTS_KEY);
  const envelope = migrateStorageEnvelope(stored, CURRENT_SCHEMA_VERSION, []);
  await setLocal(SAVED_RESULTS_KEY, envelope);
  return envelope.data;
}

export async function saveSavedResults(results: SavedResult[]): Promise<void> {
  await setLocal(SAVED_RESULTS_KEY, { schemaVersion: CURRENT_SCHEMA_VERSION, data: results });
}
```

- [ ] **Step 4: Run storage tests**

Run:

```powershell
npm test -- --run tests/storage/storage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit storage foundation**

Run:

```powershell
git add src/lib/storage src/lib/prompts tests/storage
git commit -m "feat: add schema-versioned local storage"
```

Expected: commit succeeds.

## Task 3: AI Types, Model Config, and Streaming Parser

**Files:**
- Create: `src/lib/ai/models.ts`
- Create: `src/lib/ai/types.ts`
- Create: `src/lib/ai/stream.ts`
- Test: `tests/ai/stream.test.ts`

- [ ] **Step 1: Write failing AI stream tests**

Create `tests/ai/stream.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractResponseTextDelta, resolveSelectedModel } from "../../src/lib/ai/stream";

describe("OpenAI stream parser", () => {
  it("extracts text deltas from Responses API stream events", () => {
    const event = {
      type: "response.output_text.delta",
      delta: "Hello"
    };

    expect(extractResponseTextDelta(event)).toBe("Hello");
  });

  it("ignores non-text stream events", () => {
    expect(extractResponseTextDelta({ type: "response.created" })).toBe("");
  });
});

describe("model resolution", () => {
  it("prefers custom model when provided", () => {
    expect(resolveSelectedModel("gpt-5.4-mini", "custom-model")).toBe("custom-model");
  });

  it("uses preset model when custom model is empty", () => {
    expect(resolveSelectedModel("gpt-5.4-mini", " ")).toBe("gpt-5.4-mini");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- --run tests/ai/stream.test.ts
```

Expected: FAIL because `src/lib/ai/stream` does not exist.

- [ ] **Step 3: Implement AI model config and stream helpers**

Create `src/lib/ai/models.ts`:

```ts
export const OPENAI_MODEL_PRESETS = [
  { id: "gpt-5.5", label: "GPT-5.5", description: "Best for complex reasoning and high-quality work." },
  { id: "gpt-5.4", label: "GPT-5.4", description: "General flagship model." },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini", description: "Fast and cost-conscious default." },
  { id: "gpt-5.4-nano", label: "GPT-5.4 nano", description: "Lowest latency for short tasks." }
] as const;

export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
```

Create `src/lib/ai/types.ts`:

```ts
export type AiRole = "system" | "user" | "assistant";

export type AiMessage = {
  role: AiRole;
  content: string;
};

export type AiStreamEvent =
  | { type: "response.output_text.delta"; delta: string }
  | { type: "response.completed" }
  | { type: "response.failed"; error?: { message?: string } }
  | { type: string; [key: string]: unknown };

export type AiStreamChunk =
  | { type: "chunk"; delta: string }
  | { type: "done" }
  | { type: "error"; message: string };
```

Create `src/lib/ai/stream.ts`:

```ts
import { DEFAULT_OPENAI_MODEL } from "./models";
import type { AiStreamEvent } from "./types";

export function resolveSelectedModel(modelPreset?: string, customModel?: string): string {
  const custom = customModel?.trim();
  if (custom) return custom;
  return modelPreset?.trim() || DEFAULT_OPENAI_MODEL;
}

export function extractResponseTextDelta(event: AiStreamEvent): string {
  if (event.type !== "response.output_text.delta") return "";
  return typeof event.delta === "string" ? event.delta : "";
}

export function mapOpenAIError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "OpenAI request failed. Check your API key, model, network, and quota.";
}
```

- [ ] **Step 4: Run AI tests**

Run:

```powershell
npm test -- --run tests/ai/stream.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit AI primitives**

Run:

```powershell
git add src/lib/ai tests/ai
git commit -m "feat: add openai model and stream primitives"
```

Expected: commit succeeds.

## Task 4: Prompt Builders

**Files:**
- Create: `src/lib/prompts/builders.ts`
- Test: `tests/prompts/builders.test.ts`

- [ ] **Step 1: Write failing prompt builder tests**

Create `tests/prompts/builders.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildPagePrompt,
  buildSelectionPrompt,
  buildUserChatMessages
} from "../../src/lib/prompts/builders";

describe("prompt builders", () => {
  it("builds a page prompt with truncation warning", () => {
    const prompt = buildPagePrompt({
      title: "Quarterly Ops Review",
      url: "https://example.com/report",
      text: "Revenue rose.",
      warnings: ["Page content was truncated to 40,000 characters."]
    });

    expect(prompt).toContain("Quarterly Ops Review");
    expect(prompt).toContain("https://example.com/report");
    expect(prompt).toContain("Revenue rose.");
    expect(prompt).toContain("partial page content");
  });

  it("builds a Vietnamese translation selection prompt", () => {
    const prompt = buildSelectionPrompt("translate_vi", "Hello team");

    expect(prompt).toContain("Translate");
    expect(prompt).toContain("Vietnamese");
    expect(prompt).toContain("Hello team");
  });

  it("builds chat messages with a stable system instruction", () => {
    const messages = buildUserChatMessages("Explain this");

    expect(messages[0].role).toBe("system");
    expect(messages[1]).toEqual({ role: "user", content: "Explain this" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- --run tests/prompts/builders.test.ts
```

Expected: FAIL because `src/lib/prompts/builders` does not exist.

- [ ] **Step 3: Implement prompt builders**

Create `src/lib/prompts/builders.ts`:

```ts
import type { AiMessage } from "../ai/types";
import type { SelectionAction } from "../selection/types";

export type PagePromptInput = {
  title: string;
  url: string;
  text: string;
  warnings: string[];
};

const SYSTEM_MESSAGE =
  "You are a concise personal AI work assistant. Help the user read, understand, rewrite, analyze, and turn browser content into action. Prefer practical structure and clear next steps.";

export function buildUserChatMessages(input: string): AiMessage[] {
  return [
    { role: "system", content: SYSTEM_MESSAGE },
    { role: "user", content: input }
  ];
}

export function buildPagePrompt(input: PagePromptInput): string {
  const warningText = input.warnings.length
    ? `\nWarnings: ${input.warnings.join(" ")} Treat this as partial page content when relevant.\n`
    : "";

  return [
    "Read this page and summarize it from a CEO perspective.",
    "",
    `Title: ${input.title}`,
    `URL: ${input.url}`,
    warningText.trim(),
    "Return:",
    "1. Key points",
    "2. Applicable opportunities",
    "3. Implementation risks",
    "4. Immediate action items",
    "",
    "Page content:",
    input.text
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSelectionPrompt(action: SelectionAction, text: string): string {
  const instructions: Record<SelectionAction, string> = {
    explain: "Explain this selected text clearly and practically.",
    translate_vi: "Translate this selected text to Vietnamese while preserving meaning and tone.",
    rewrite_professional: "Rewrite this selected text more professionally. Keep it concise and readable.",
    summarize: "Summarize this selected text into the most important points.",
    action_list: "Convert this selected text into a bullet/action list with clear next steps."
  };

  return `${instructions[action]}\n\nSelected text:\n${text}`;
}
```

Create `src/lib/selection/types.ts`:

```ts
export type SelectionAction =
  | "explain"
  | "translate_vi"
  | "rewrite_professional"
  | "summarize"
  | "action_list";
```

- [ ] **Step 4: Run prompt tests**

Run:

```powershell
npm test -- --run tests/prompts/builders.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit prompt builders**

Run:

```powershell
git add src/lib/prompts src/lib/selection tests/prompts
git commit -m "feat: add work prompt builders"
```

Expected: commit succeeds.

## Task 5: Page Extraction

**Files:**
- Create: `src/lib/extraction/types.ts`
- Create: `src/lib/extraction/fallback.ts`
- Create: `src/lib/extraction/readability.ts`
- Create: `src/lib/extraction/index.ts`
- Test: `tests/extraction/extraction.test.ts`

- [ ] **Step 1: Write failing extraction tests**

Create `tests/extraction/extraction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractPageContent } from "../../src/lib/extraction";

describe("page extraction", () => {
  it("extracts article text and metadata", () => {
    document.body.innerHTML = `
      <nav>Navigation should disappear</nav>
      <article>
        <h1>Operations Review</h1>
        <p>Revenue rose because fulfillment improved.</p>
        <ul><li>Ship faster</li></ul>
      </article>
    `;
    document.title = "Ops Page";

    const result = extractPageContent("https://example.com/ops");

    expect(result.title).toBe("Ops Page");
    expect(result.url).toBe("https://example.com/ops");
    expect(result.text).toContain("Operations Review");
    expect(result.text).toContain("Revenue rose");
    expect(result.text).not.toContain("Navigation should disappear");
  });

  it("truncates large page content and records a warning", () => {
    document.body.innerHTML = `<main><p>${"a".repeat(41000)}</p></main>`;

    const result = extractPageContent("https://example.com/long");

    expect(result.text.length).toBeLessThanOrEqual(40000);
    expect(result.warnings).toContain("Page content was truncated to 40,000 characters.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- --run tests/extraction/extraction.test.ts
```

Expected: FAIL because `src/lib/extraction` does not exist.

- [ ] **Step 3: Implement extraction types and fallback**

Create `src/lib/extraction/types.ts`:

```ts
export type ExtractionMethod = "readability" | "dom-fallback";

export type ExtractedPageContent = {
  title: string;
  url: string;
  text: string;
  method: ExtractionMethod;
  warnings: string[];
};
```

Create `src/lib/extraction/fallback.ts`:

```ts
const BLOCKED_SELECTORS = "script, style, nav, footer, aside, noscript, svg, canvas";

export function extractDomText(root: Document): string {
  const clone = root.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(BLOCKED_SELECTORS).forEach((node) => node.remove());

  const preferred = clone.querySelector("main, article") ?? clone.body ?? clone;
  return Array.from(preferred.querySelectorAll("h1,h2,h3,h4,p,li,td,th"))
    .map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter(Boolean)
    .join("\n");
}
```

- [ ] **Step 4: Implement Readability wrapper and extraction facade**

Create `src/lib/extraction/readability.ts`:

```ts
import { Readability } from "@mozilla/readability";

export function extractReadableText(documentInput: Document): string {
  const clone = documentInput.cloneNode(true) as Document;
  const article = new Readability(clone).parse();

  if (!article?.textContent?.trim()) {
    return "";
  }

  return article.textContent.replace(/\n{3,}/g, "\n\n").trim();
}
```

Create `src/lib/extraction/index.ts`:

```ts
import { extractDomText } from "./fallback";
import { extractReadableText } from "./readability";
import type { ExtractedPageContent, ExtractionMethod } from "./types";

const MAX_PAGE_CONTEXT_CHARS = 40000;

export function extractPageContent(url = window.location.href): ExtractedPageContent {
  const warnings: string[] = [];
  let method: ExtractionMethod = "readability";
  let text = extractReadableText(document);

  if (!text) {
    method = "dom-fallback";
    text = extractDomText(document);
  }

  if (text.length > MAX_PAGE_CONTEXT_CHARS) {
    text = text.slice(0, MAX_PAGE_CONTEXT_CHARS);
    warnings.push("Page content was truncated to 40,000 characters.");
  }

  return {
    title: document.title || "Untitled page",
    url,
    text,
    method,
    warnings
  };
}

export type { ExtractedPageContent, ExtractionMethod } from "./types";
```

- [ ] **Step 5: Run extraction tests**

Run:

```powershell
npm test -- --run tests/extraction/extraction.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit extraction**

Run:

```powershell
git add src/lib/extraction tests/extraction
git commit -m "feat: add active page extraction"
```

Expected: commit succeeds.

## Task 6: Messaging Contracts and Background Streaming

**Files:**
- Create: `src/lib/messaging/types.ts`
- Create: `src/lib/messaging/ports.ts`
- Create: `src/lib/ai/openai.ts`
- Modify: `entrypoints/background.ts`

- [ ] **Step 1: Create message contracts**

Create `src/lib/messaging/types.ts`:

```ts
import type { AiMessage } from "../ai/types";
import type { SelectionAction } from "../selection/types";

export type ExtensionMessage =
  | { type: "ACTIVATE_ACTIVE_TAB_AGENT"; requestId: string }
  | { type: "EXTRACT_ACTIVE_PAGE"; requestId: string }
  | {
      type: "SELECTION_ACTION";
      requestId: string;
      action: SelectionAction;
      text: string;
      url: string;
      title: string;
    };

export type AiPortRequest = {
  type: "AI_CHAT_REQUEST";
  requestId: string;
  messages: AiMessage[];
  model: string;
};

export type AiPortResponse =
  | { type: "AI_STREAM_CHUNK"; requestId: string; delta: string }
  | { type: "AI_STREAM_DONE"; requestId: string }
  | { type: "AI_STREAM_ERROR"; requestId: string; message: string };
```

Create `src/lib/messaging/ports.ts`:

```ts
export const AI_STREAM_PORT = "ai-stream";
```

- [ ] **Step 2: Implement OpenAI streaming client**

Create `src/lib/ai/openai.ts`:

```ts
import { extractResponseTextDelta, mapOpenAIError } from "./stream";
import type { AiMessage } from "./types";

type StreamCallbacks = {
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
};

export async function streamOpenAIResponse(input: {
  apiKey: string;
  model: string;
  messages: AiMessage[];
  signal?: AbortSignal;
  callbacks: StreamCallbacks;
}): Promise<void> {
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: input.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        input: input.messages.map((message) => ({
          role: message.role,
          content: message.content
        })),
        stream: true
      })
    });

    if (!response.ok || !response.body) {
      input.callbacks.onError(`OpenAI request failed with HTTP ${response.status}.`);
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
        if (data === "[DONE]") continue;

        const event = JSON.parse(data);
        const delta = extractResponseTextDelta(event);
        if (delta) input.callbacks.onDelta(delta);
      }
    }

    input.callbacks.onDone();
  } catch (error) {
    input.callbacks.onError(mapOpenAIError(error));
  }
}
```

- [ ] **Step 3: Wire background port and action click**

Replace `entrypoints/background.ts` with:

```ts
import { streamOpenAIResponse } from "../src/lib/ai/openai";
import { resolveSelectedModel } from "../src/lib/ai/stream";
import { AI_STREAM_PORT } from "../src/lib/messaging/ports";
import type { AiPortRequest } from "../src/lib/messaging/types";
import { getSettings } from "../src/lib/storage";

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== AI_STREAM_PORT) return;

    const controller = new AbortController();

    port.onDisconnect.addListener(() => {
      controller.abort();
    });

    port.onMessage.addListener(async (message: AiPortRequest) => {
      if (message.type !== "AI_CHAT_REQUEST") return;

      const settings = await getSettings();
      const apiKey = settings.openaiApiKey?.trim();

      if (!apiKey) {
        port.postMessage({
          type: "AI_STREAM_ERROR",
          requestId: message.requestId,
          message: "Add your OpenAI API key in Settings before sending a request."
        });
        return;
      }

      await streamOpenAIResponse({
        apiKey,
        model: resolveSelectedModel(message.model, settings.customModel),
        messages: message.messages,
        signal: controller.signal,
        callbacks: {
          onDelta: (delta) =>
            port.postMessage({ type: "AI_STREAM_CHUNK", requestId: message.requestId, delta }),
          onDone: () => port.postMessage({ type: "AI_STREAM_DONE", requestId: message.requestId }),
          onError: (errorMessage) =>
            port.postMessage({
              type: "AI_STREAM_ERROR",
              requestId: message.requestId,
              message: errorMessage
            })
        }
      });
    });
  });
});
```

- [ ] **Step 4: Run typecheck and build**

Run:

```powershell
npm run build
```

Expected: build exits 0.

- [ ] **Step 5: Commit background streaming**

Run:

```powershell
git add entrypoints/background.ts src/lib/ai src/lib/messaging
git commit -m "feat: stream openai responses from background"
```

Expected: commit succeeds.

## Task 7: Content Agent, Selection Toolbar, and Extraction Bridge

**Files:**
- Create: `src/lib/selection/actions.ts`
- Create: `src/lib/selection/toolbar.ts`
- Test: `tests/selection/toolbar.test.ts`
- Modify: `entrypoints/active-tab-agent.ts`
- Modify: `entrypoints/background.ts`

- [ ] **Step 1: Write failing toolbar tests**

Create `tests/selection/toolbar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSelectionLengthAllowed, renderSelectionToolbar } from "../../src/lib/selection/toolbar";

describe("selection toolbar", () => {
  it("accepts selections between 20 and 20000 characters", () => {
    expect(isSelectionLengthAllowed("a".repeat(19))).toBe(false);
    expect(isSelectionLengthAllowed("a".repeat(20))).toBe(true);
    expect(isSelectionLengthAllowed("a".repeat(20000))).toBe(true);
    expect(isSelectionLengthAllowed("a".repeat(20001))).toBe(false);
  });

  it("renders five action buttons", () => {
    const toolbar = renderSelectionToolbar({ top: 10, left: 20 }, () => undefined);

    expect(toolbar.querySelectorAll("button")).toHaveLength(5);
    expect(toolbar.textContent).toContain("Explain");
    expect(toolbar.textContent).toContain("Translate VI");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- --run tests/selection/toolbar.test.ts
```

Expected: FAIL because `src/lib/selection/toolbar` does not exist.

- [ ] **Step 3: Implement toolbar utilities**

Create `src/lib/selection/actions.ts`:

```ts
import type { SelectionAction } from "./types";

export const SELECTION_ACTIONS: Array<{ action: SelectionAction; label: string }> = [
  { action: "explain", label: "Explain" },
  { action: "translate_vi", label: "Translate VI" },
  { action: "rewrite_professional", label: "Rewrite" },
  { action: "summarize", label: "Summarize" },
  { action: "action_list", label: "Action list" }
];
```

Create `src/lib/selection/toolbar.ts`:

```ts
import { SELECTION_ACTIONS } from "./actions";
import type { SelectionAction } from "./types";

const MIN_SELECTION_CHARS = 20;
const MAX_SELECTION_CHARS = 20000;

export function isSelectionLengthAllowed(text: string): boolean {
  const length = text.trim().length;
  return length >= MIN_SELECTION_CHARS && length <= MAX_SELECTION_CHARS;
}

export function isSelectionTooLong(text: string): boolean {
  return text.trim().length > MAX_SELECTION_CHARS;
}

export function renderSelectionToolbar(
  position: { top: number; left: number },
  onAction: (action: SelectionAction) => void
): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.dataset.personalAiToolbar = "true";
  toolbar.style.position = "fixed";
  toolbar.style.top = `${position.top}px`;
  toolbar.style.left = `${position.left}px`;
  toolbar.style.zIndex = "2147483647";
  toolbar.style.display = "flex";
  toolbar.style.gap = "4px";
  toolbar.style.padding = "6px";
  toolbar.style.border = "1px solid #3f3f46";
  toolbar.style.borderRadius = "6px";
  toolbar.style.background = "#18181b";
  toolbar.style.boxShadow = "0 8px 24px rgba(0,0,0,0.24)";

  for (const item of SELECTION_ACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.style.color = "#f4f4f5";
    button.style.background = "#27272a";
    button.style.border = "0";
    button.style.borderRadius = "4px";
    button.style.padding = "4px 6px";
    button.style.font = "12px system-ui, sans-serif";
    button.addEventListener("click", () => onAction(item.action));
    toolbar.appendChild(button);
  }

  return toolbar;
}
```

- [ ] **Step 4: Wire active-tab agent**

Replace `entrypoints/active-tab-agent.ts` with:

```ts
import { extractPageContent } from "../src/lib/extraction";
import { buildSelectionPrompt } from "../src/lib/prompts/builders";
import { isSelectionLengthAllowed, isSelectionTooLong, renderSelectionToolbar } from "../src/lib/selection/toolbar";
import type { SelectionAction } from "../src/lib/selection/types";

export default defineUnlistedScript(() => {
  if (window.__personalAiSidebarAgentInstalled) return;
  window.__personalAiSidebarAgentInstalled = true;

  let toolbar: HTMLElement | null = null;

  function removeToolbar() {
    toolbar?.remove();
    toolbar = null;
  }

  function currentSelectionText(): string {
    return window.getSelection()?.toString().trim() ?? "";
  }

  function selectionPosition(): { top: number; left: number } {
    const selection = window.getSelection();
    const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
    return {
      top: Math.max(8, rect ? rect.top - 42 : 8),
      left: Math.max(8, rect ? rect.left : 8)
    };
  }

  function sendSelectionAction(action: SelectionAction, text: string) {
    chrome.runtime.sendMessage({
      type: "SELECTION_ACTION",
      requestId: crypto.randomUUID(),
      action,
      text,
      url: window.location.href,
      title: document.title || "Untitled page",
      prompt: buildSelectionPrompt(action, text)
    });
  }

  document.addEventListener("selectionchange", () => {
    window.setTimeout(() => {
      removeToolbar();
      const text = currentSelectionText();
      if (!text) return;

      if (isSelectionTooLong(text)) {
        chrome.runtime.sendMessage({
          type: "SELECTION_TOO_LONG",
          requestId: crypto.randomUUID(),
          length: text.length
        });
        return;
      }

      if (!isSelectionLengthAllowed(text)) return;

      toolbar = renderSelectionToolbar(selectionPosition(), (action) => {
        sendSelectionAction(action, text);
        removeToolbar();
      });
      document.body.appendChild(toolbar);
    }, 120);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "EXTRACT_PAGE_CONTENT") {
      sendResponse(extractPageContent(window.location.href));
    }
    return true;
  });
});
```

Add `src/types/window.d.ts`:

```ts
export {};

declare global {
  interface Window {
    __personalAiSidebarAgentInstalled?: boolean;
  }
}
```

- [ ] **Step 5: Extend background for pending selection requests**

In `entrypoints/background.ts`, add an in-memory pending selection request:

```ts
let pendingSelectionPrompt: { requestId: string; prompt: string; title: string } | null = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SELECTION_ACTION") {
    pendingSelectionPrompt = {
      requestId: message.requestId,
      prompt: message.prompt,
      title: message.title
    };
    if (sender.tab?.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => undefined);
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "GET_PENDING_SELECTION_PROMPT") {
    const value = pendingSelectionPrompt;
    pendingSelectionPrompt = null;
    sendResponse(value);
    return true;
  }

  return false;
});
```

Keep the existing `onConnect` streaming handler in the same `defineBackground` callback.

- [ ] **Step 6: Run toolbar tests and build**

Run:

```powershell
npm test -- --run tests/selection/toolbar.test.ts
npm run build
```

Expected: tests PASS and build exits 0.

- [ ] **Step 7: Commit content agent**

Run:

```powershell
git add entrypoints/active-tab-agent.ts entrypoints/background.ts src/lib/selection src/types tests/selection
git commit -m "feat: add active tab selection toolbar"
```

Expected: commit succeeds.

## Task 8: Sidepanel Chat, Settings, Prompts, and Saved Results UI

**Files:**
- Modify: `entrypoints/sidepanel/App.tsx`
- Create: `entrypoints/sidepanel/components/HeaderBar.tsx`
- Create: `entrypoints/sidepanel/components/ChatComposer.tsx`
- Create: `entrypoints/sidepanel/components/ChatMessage.tsx`
- Create: `entrypoints/sidepanel/components/SettingsPanel.tsx`
- Create: `entrypoints/sidepanel/components/PromptManager.tsx`
- Create: `entrypoints/sidepanel/components/SavedResults.tsx`

- [ ] **Step 1: Create presentational components**

Create `entrypoints/sidepanel/components/HeaderBar.tsx`:

```tsx
export type HeaderView = "chat" | "prompts" | "saved" | "settings";

export function HeaderBar(props: {
  view: HeaderView;
  onViewChange: (view: HeaderView) => void;
  onReadPage: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
      <button className="text-sm font-semibold text-zinc-50" onClick={() => props.onViewChange("chat")}>
        Personal AI
      </button>
      <div className="flex gap-1">
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs" onClick={props.onReadPage}>Read page</button>
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onViewChange("prompts")}>Prompts</button>
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onViewChange("saved")}>Saved</button>
        <button className="rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onViewChange("settings")}>Settings</button>
      </div>
    </header>
  );
}
```

Create `entrypoints/sidepanel/components/ChatMessage.tsx`:

```tsx
export function ChatMessage(props: {
  role: "user" | "assistant" | "system";
  content: string;
  onSave?: () => void;
}) {
  const isAssistant = props.role === "assistant";
  return (
    <article className={isAssistant ? "rounded bg-zinc-900 p-3" : "rounded bg-zinc-800 p-3"}>
      <div className="mb-1 text-[11px] uppercase text-zinc-500">{props.role}</div>
      <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-100">{props.content}</div>
      {isAssistant && props.onSave ? (
        <button className="mt-2 rounded bg-zinc-700 px-2 py-1 text-xs" onClick={props.onSave}>Save</button>
      ) : null}
    </article>
  );
}
```

Create `entrypoints/sidepanel/components/ChatComposer.tsx`:

```tsx
import { useState } from "react";

export function ChatComposer(props: { disabled: boolean; onSend: (text: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <form
      className="border-t border-zinc-800 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const text = value.trim();
        if (!text) return;
        props.onSend(text);
        setValue("");
      }}
    >
      <textarea
        className="h-24 w-full resize-none rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50 outline-none"
        value={value}
        disabled={props.disabled}
        onChange={(event) => setValue(event.target.value)}
        aria-label="Ask about your work"
      />
      <button className="mt-2 w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:bg-zinc-700" disabled={props.disabled}>
        Send
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create settings, prompt, and saved views**

Create `entrypoints/sidepanel/components/SettingsPanel.tsx`:

```tsx
import { OPENAI_MODEL_PRESETS } from "../../../src/lib/ai/models";
import type { Settings } from "../../../src/lib/storage/types";

export function SettingsPanel(props: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  return (
    <section className="space-y-3 p-3">
      <p className="rounded border border-amber-700 bg-amber-950 p-2 text-xs text-amber-100">
        Your API key is stored locally in Chrome extension storage for this private MVP. It is not encrypted secret storage.
      </p>
      <label className="block text-xs text-zinc-400">
        OpenAI API key
        <input
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
          type="password"
          value={props.settings.openaiApiKey ?? ""}
          onChange={(event) => props.onChange({ ...props.settings, openaiApiKey: event.target.value, updatedAt: new Date().toISOString() })}
        />
      </label>
      <label className="block text-xs text-zinc-400">
        Model preset
        <select
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
          value={props.settings.modelPreset}
          onChange={(event) => props.onChange({ ...props.settings, modelPreset: event.target.value, updatedAt: new Date().toISOString() })}
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
          onChange={(event) => props.onChange({ ...props.settings, customModel: event.target.value, updatedAt: new Date().toISOString() })}
        />
      </label>
    </section>
  );
}
```

Create `entrypoints/sidepanel/components/PromptManager.tsx`:

```tsx
import type { PromptTemplate } from "../../../src/lib/prompts/types";

export function PromptManager(props: {
  prompts: PromptTemplate[];
  onChange: (prompts: PromptTemplate[]) => void;
}) {
  function updatePrompt(id: string, instruction: string) {
    props.onChange(
      props.prompts.map((prompt) =>
        prompt.id === id ? { ...prompt, instruction, updatedAt: new Date().toISOString() } : prompt
      )
    );
  }

  function addPrompt() {
    const now = new Date().toISOString();
    props.onChange([
      ...props.prompts,
      {
        id: crypto.randomUUID(),
        name: "Custom prompt",
        instruction: "Analyze this content and return concise practical recommendations.",
        category: "custom",
        sortOrder: props.prompts.length,
        createdAt: now,
        updatedAt: now
      }
    ]);
  }

  function deletePrompt(id: string) {
    props.onChange(props.prompts.filter((prompt) => prompt.id !== id));
  }

  return (
    <section className="space-y-3 p-3">
      <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={addPrompt}>New prompt</button>
      {props.prompts.map((prompt) => (
        <article key={prompt.id} className="rounded border border-zinc-800 p-3">
          <div className="text-sm font-medium text-zinc-100">{prompt.name}</div>
          <textarea
            className="mt-2 h-24 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-sm text-zinc-50"
            value={prompt.instruction}
            onChange={(event) => updatePrompt(prompt.id, event.target.value)}
          />
          <button className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => deletePrompt(prompt.id)}>Delete</button>
        </article>
      ))}
    </section>
  );
}
```

Create `entrypoints/sidepanel/components/SavedResults.tsx`:

```tsx
import type { SavedResult } from "../../../src/lib/storage/types";

export function SavedResults(props: {
  results: SavedResult[];
  onDelete: (id: string) => void;
}) {
  return (
    <section className="space-y-3 p-3">
      {props.results.length === 0 ? <p className="text-sm text-zinc-400">No saved results yet.</p> : null}
      {props.results.map((result) => (
        <article key={result.id} className="rounded border border-zinc-800 p-3">
          <div className="text-sm font-medium text-zinc-100">{result.title}</div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{result.outputMarkdown}</div>
          <button className="mt-2 rounded bg-zinc-800 px-2 py-1 text-xs" onClick={() => props.onDelete(result.id)}>Delete</button>
        </article>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Wire sidepanel app**

Replace `entrypoints/sidepanel/App.tsx` with:

```tsx
import { useEffect, useMemo, useState } from "react";
import { buildUserChatMessages } from "../../src/lib/prompts/builders";
import { getPromptTemplates, getSavedResults, getSettings, savePromptTemplates, saveSavedResults, saveSettings } from "../../src/lib/storage";
import type { PromptTemplate } from "../../src/lib/prompts/types";
import type { SavedResult, Settings } from "../../src/lib/storage/types";
import { AI_STREAM_PORT } from "../../src/lib/messaging/ports";
import type { AiPortResponse } from "../../src/lib/messaging/types";
import { ChatComposer } from "./components/ChatComposer";
import { ChatMessage } from "./components/ChatMessage";
import { HeaderBar, type HeaderView } from "./components/HeaderBar";
import { PromptManager } from "./components/PromptManager";
import { SavedResults } from "./components/SavedResults";
import { SettingsPanel } from "./components/SettingsPanel";

type ChatItem = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export default function App() {
  const [view, setView] = useState<HeaderView>("chat");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [savedResults, setSavedResultsState] = useState<SavedResult[]>([]);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");

  const missingApiKey = useMemo(() => !settings?.openaiApiKey?.trim(), [settings]);

  useEffect(() => {
    Promise.all([getSettings(), getPromptTemplates(), getSavedResults()]).then(([loadedSettings, loadedPrompts, loadedSaved]) => {
      setSettings(loadedSettings);
      setPrompts(loadedPrompts);
      setSavedResultsState(loadedSaved);
    });
  }, []);

  async function updateSettings(next: Settings) {
    setSettings(next);
    await saveSettings(next);
  }

  async function updatePrompts(next: PromptTemplate[]) {
    setPrompts(next);
    await savePromptTemplates(next);
  }

  async function updateSavedResults(next: SavedResult[]) {
    setSavedResultsState(next);
    await saveSavedResults(next);
  }

  function sendPrompt(text: string) {
    if (!settings) return;
    setError("");
    setStreaming(true);

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" }
    ]);

    const port = chrome.runtime.connect({ name: AI_STREAM_PORT });
    port.onMessage.addListener((message: AiPortResponse) => {
      if (message.requestId !== requestId) return;

      if (message.type === "AI_STREAM_CHUNK") {
        setMessages((current) =>
          current.map((item) => (item.id === assistantId ? { ...item, content: item.content + message.delta } : item))
        );
      }

      if (message.type === "AI_STREAM_DONE") {
        setStreaming(false);
        port.disconnect();
      }

      if (message.type === "AI_STREAM_ERROR") {
        setStreaming(false);
        setError(message.message);
        port.disconnect();
      }
    });

    port.postMessage({
      type: "AI_CHAT_REQUEST",
      requestId,
      messages: buildUserChatMessages(text),
      model: settings.modelPreset || "gpt-5.4-mini"
    });
  }

  async function saveMessage(item: ChatItem) {
    const next = [
      {
        id: crypto.randomUUID(),
        title: item.content.slice(0, 60) || "Saved response",
        sourceType: "chat" as const,
        outputMarkdown: item.content,
        createdAt: new Date().toISOString()
      },
      ...savedResults
    ];
    await updateSavedResults(next);
  }

  function readPage() {
    setError("Read page wiring is implemented in the next task.");
  }

  if (!settings) {
    return <main className="min-h-screen bg-zinc-950 p-4 text-sm text-zinc-300">Loading...</main>;
  }

  return (
    <main className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <HeaderBar view={view} onViewChange={setView} onReadPage={readPage} />
      {error ? <div className="border-b border-red-900 bg-red-950 p-2 text-xs text-red-100">{error}</div> : null}
      {view === "settings" ? <SettingsPanel settings={settings} onChange={updateSettings} /> : null}
      {view === "prompts" ? <PromptManager prompts={prompts} onChange={updatePrompts} /> : null}
      {view === "saved" ? <SavedResults results={savedResults} onDelete={(id) => updateSavedResults(savedResults.filter((item) => item.id !== id))} /> : null}
      {view === "chat" ? (
        <>
          {missingApiKey ? (
            <section className="p-3 text-sm text-amber-100">Add your OpenAI API key in Settings before sending requests.</section>
          ) : null}
          <section className="flex-1 space-y-3 overflow-auto p-3">
            {messages.length === 0 ? <p className="text-sm text-zinc-400">Ask about the page, selected text, or your work.</p> : null}
            {messages.map((item) => (
              <ChatMessage key={item.id} role={item.role} content={item.content} onSave={item.role === "assistant" ? () => saveMessage(item) : undefined} />
            ))}
          </section>
          <ChatComposer disabled={streaming || missingApiKey} onSend={sendPrompt} />
        </>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4: Run build**

Run:

```powershell
npm run build
```

Expected: build exits 0.

- [ ] **Step 5: Commit sidepanel UI**

Run:

```powershell
git add entrypoints/sidepanel
git commit -m "feat: add chat-first sidepanel ui"
```

Expected: commit succeeds.

## Task 9: Read Page and Pending Selection Integration

**Files:**
- Modify: `entrypoints/background.ts`
- Modify: `entrypoints/sidepanel/App.tsx`

- [ ] **Step 1: Add background active-tab extraction**

In `entrypoints/background.ts`, add message handling for `EXTRACT_ACTIVE_PAGE`:

```ts
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab is available.");
  return tab;
}

async function injectContentAgent(tabId: number) {
  await chrome.scripting.executeScript({
    target: { tabId },
      files: ["/active-tab-agent.js"]
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_ACTIVE_PAGE") {
    getActiveTab()
      .then(async (tab) => {
        await injectContentAgent(tab.id!);
        const response = await chrome.tabs.sendMessage(tab.id!, { type: "EXTRACT_PAGE_CONTENT" });
        sendResponse(response);
      })
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : "Page extraction failed." }));
    return true;
  }

  return false;
});
```

Keep this logic inside the WXT `defineBackground` callback and merge it with the selection pending-request listener from Task 7.

- [ ] **Step 2: Wire Read page in sidepanel**

Replace the `readPage` function in `entrypoints/sidepanel/App.tsx`:

```tsx
async function readPage() {
  setError("");
  setView("chat");
  const response = await chrome.runtime.sendMessage({
    type: "EXTRACT_ACTIVE_PAGE",
    requestId: crypto.randomUUID()
  });

  if (response?.error) {
    setError(response.error);
    return;
  }

  if (!response?.text) {
    setError("This page did not return readable content.");
    return;
  }

  sendPrompt(
    [
      "Read this page and summarize it from a CEO perspective.",
      "",
      `Title: ${response.title}`,
      `URL: ${response.url}`,
      response.warnings?.length ? `Warnings: ${response.warnings.join(" ")}` : "",
      "",
      response.text
    ]
      .filter(Boolean)
      .join("\n")
  );
}
```

- [ ] **Step 3: Load pending selection prompt on sidepanel mount**

Add this effect in `entrypoints/sidepanel/App.tsx` after the initial settings load effect:

```tsx
useEffect(() => {
  chrome.runtime
    .sendMessage({ type: "GET_PENDING_SELECTION_PROMPT", requestId: crypto.randomUUID() })
    .then((pending) => {
      if (pending?.prompt) {
        setView("chat");
        sendPrompt(pending.prompt);
      }
    })
    .catch(() => undefined);
}, [settings?.openaiApiKey]);
```

- [ ] **Step 4: Run build**

Run:

```powershell
npm run build
```

Expected: build exits 0. Inspect the WXT output once to confirm the unlisted script path is `/active-tab-agent.js`; if WXT emits a different unlisted-script path, update `injectContentAgent` to the generated path and keep the manifest free of global content script matches.

- [ ] **Step 5: Commit page and selection integration**

Run:

```powershell
git add entrypoints/background.ts entrypoints/sidepanel/App.tsx
git commit -m "feat: connect page and selection actions"
```

Expected: commit succeeds.

## Task 10: Full Automated Verification

**Files:**
- Modify only files required by failures found during this task.

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm test -- --run
```

Expected: all tests PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: WXT production build exits 0 and creates an unpacked extension output directory.

- [ ] **Step 3: Inspect generated manifest**

Run:

```powershell
Get-ChildItem -Recurse -Filter manifest.json .output | Select-Object -First 1 | ForEach-Object { Get-Content -Raw -LiteralPath $_.FullName }
```

Expected: manifest includes `storage`, `activeTab`, `sidePanel`, `scripting`, and `https://api.openai.com/*`; it does not include `<all_urls>` in host permissions and does not declare a global content script match for `<all_urls>`.

- [ ] **Step 4: Commit verification fixes**

If any fixes were required, run:

```powershell
git add .
git commit -m "fix: stabilize mvp verification"
```

Expected: commit succeeds if there were changes. If no changes were required, run `git status --short` and confirm it prints nothing.

## Task 11: Manual Chrome Verification

**Files:**
- Modify only files required by manual verification failures.

- [ ] **Step 1: Load extension**

Run:

```powershell
npm run dev
```

Expected: WXT prints the development extension output path. Open Chrome, go to `chrome://extensions`, enable Developer Mode, choose Load unpacked, and select the WXT output directory.

- [ ] **Step 2: Verify settings**

Manual checks:

```text
1. Open the extension side panel.
2. Click Settings.
3. Enter an OpenAI API key.
4. Select GPT-5.4 mini.
5. Enter and clear a custom model value.
6. Close and reopen the side panel.
```

Expected: settings persist, and the settings screen says the API key is stored locally and is not encrypted secret storage.

- [ ] **Step 3: Verify chat streaming**

Manual checks:

```text
1. In Chat, send: "Summarize the value of this tool in three bullets."
2. Watch the assistant response.
3. Save the response.
4. Open Saved.
```

Expected: response streams into the chat UI, and the saved result appears in Saved.

- [ ] **Step 4: Verify Read page**

Manual checks:

```text
1. Open a normal article or documentation page.
2. Open the extension side panel.
3. Click Read page.
```

Expected: the page is extracted only after the click, the side panel streams a summary, and no automatic extraction happens before the click.

- [ ] **Step 5: Verify selection toolbar**

Manual checks:

```text
1. With the extension activated on a tab, select at least 20 characters on the page.
2. Confirm the floating toolbar appears.
3. Click Translate VI.
4. Open or focus the side panel if Chrome does not do it automatically.
```

Expected: the selected text is sent as a user-triggered action and the side panel streams a Vietnamese translation.

- [ ] **Step 6: Verify long selection behavior**

Manual checks:

```text
1. Select more than 20,000 characters on a long page.
2. Observe the side panel state after the content script reports the selection length.
```

Expected: the extension shows a clear "selection too long" state and does not silently truncate the selection.

- [ ] **Step 7: Commit manual verification fixes**

If manual verification required fixes, run:

```powershell
git add .
git commit -m "fix: address chrome manual verification"
```

Expected: commit succeeds if there were changes. If no changes were required, run `git status --short` and confirm it prints nothing.

## Task 12: Final Review Against Spec

**Files:**
- Modify: `docs/superpowers/specs/2026-06-24-personal-ai-sidebar-design.md` only if implementation reveals a required spec correction.

- [ ] **Step 1: Re-read design spec**

Run:

```powershell
Get-Content -Raw -LiteralPath 'docs/superpowers/specs/2026-06-24-personal-ai-sidebar-design.md'
```

Expected: spec loads successfully.

- [ ] **Step 2: Check completion criteria manually**

Confirm each line is true:

```text
Open a chat-first side panel.
Store and use a personal OpenAI API key.
Stream OpenAI responses.
Read current page content only after the user clicks Read page.
Process selected text through a floating toolbar.
Make the floating toolbar available after explicit tab activation, without global <all_urls> host permission.
Let the user fully manage prompt templates.
Let the user save selected AI results.
Avoid automatic page reading and background content sending.
Keep the code structure ready for future provider expansion.
```

Expected: every item is true or has a tracked fix committed before finishing.

- [ ] **Step 3: Run final commands**

Run:

```powershell
npm test -- --run
npm run build
git status --short
```

Expected: tests PASS, build exits 0, and git status contains no unintended changes.

- [ ] **Step 4: Final commit if needed**

If a final fix or doc update was required, run:

```powershell
git add .
git commit -m "chore: finalize private mvp"
```

Expected: commit succeeds if there were changes.
