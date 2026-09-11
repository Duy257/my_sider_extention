# OpenRouter Provider And Model Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OpenRouter as the fifth AI provider and replace the two `<select>` dropdowns in SettingsPanel with a reusable, accessible Autocomplete component that supports search and keyboard navigation.

**Architecture:** OpenRouter piggy-backs on the existing OpenAI-compatible `/v1/models` endpoint — we just register it in `providers.json`. To surface human-readable model names alongside their IDs, we widen the model fetch payload from `string[]` to `{ id, label }[]` (`ModelEntry`). A new `Autocomplete` React component replaces both `<select>` elements; provider and model selection both flow through it. UI strings stay in Vietnamese to match the rest of SettingsPanel.

**Tech Stack:** WXT + React 19 + TypeScript 5 (strict), Vitest + jsdom + `@testing-library/react` + `@testing-library/user-event`, Tailwind CSS 3.

## Global Constraints

- TypeScript 5 strict mode; prefer `unknown` + narrowing over `any`.
- Functional React components only; hooks for state.
- All user-facing strings in SettingsPanel stay in Vietnamese (matching existing copy like "Nhà cung cấp", "Mô hình", "Khóa API").
- Tailwind utility classes only; custom palette tokens are `surface`, `warm-bg`, `primary`, `primary-dark`, `stone-800/850`, `stone-400`, `stone-500`, `stone-600`, `stone-100`.
- All persisted settings flow through `chrome.storage.local` envelopes; do not change `Settings` shape.
- Provider definitions live in `src/core/ai/providers.json` and are validated by `normalizeProviders` in `src/core/ai/providers.ts` — never bypass that loader.
- `fetchModels` is the only place that knows how to parse a `/v1/models` response; do not duplicate that parsing.
- `tests/setup.ts` globally mocks `chrome.*` APIs — tests must not redefine them.
- Commits: short, focused, present tense. Run `npm run compile` and `npm test` before each commit.

---

## Task 1: Add OpenRouter Provider Entry

**Files:**
- Modify: `src/core/ai/providers.json` (append entry at end of array)

**Interfaces:**
- Consumes: existing provider shape (`id`, `label`, `base_url`, `model_url`, `requires_api_key`, `default_model`, `known_models`).
- Produces: a new `openrouter` entry visible to `getProvider("openrouter")` and `getProviderOptions()`.

- [x] **Step 1: Add the OpenRouter entry to `providers.json`**

Open `src/core/ai/providers.json`. After the last entry (`lmstudio`), add a comma after its closing `}` and append:

```json
  ,
  {
    "id": "openrouter",
    "label": "OpenRouter",
    "base_url": "https://openrouter.ai/api/v1/chat/completions",
    "model_url": "https://openrouter.ai/api/v1/models",
    "requires_api_key": true,
    "default_model": "anthropic/claude-3.5-sonnet",
    "known_models": []
  }
```

Verify the file is still valid JSON (the array must end with `]` after the new entry).

- [x] **Step 2: Run type check**

Run: `npm run compile`
Expected: exit code 0, no diagnostics.

- [x] **Step 3: Run existing tests**

Run: `npm test -- --run tests/sidepanel-settings.test.tsx`
Expected: PASS (existing assertions for `getByRole("option", { name: "OpenAI" })` still hold; no test currently asserts on the provider list length).

- [x] **Step 4: Commit**

```bash
git add src/core/ai/providers.json
git commit -m "feat(providers): register openrouter"
```

---

## Task 2: Extend `fetchModels` To Return `ModelEntry[]`

**Files:**
- Modify: `src/core/ai/client.ts:33-35` (type definitions) and `:499-560` (`fetchModels` body and signature)
- Test: `tests/openrouter-provider.test.ts` (new file, created in this task)

**Interfaces:**
- Consumes: existing `fetchModels` callers (background.ts:278).
- Produces: new exported type `ModelEntry = { id: string; label: string }` and a new `fetchModels` signature returning `Promise<{ models: ModelEntry[] } | { error: string }>`.

- [x] **Step 1: Write the failing test**

Create `tests/openrouter-provider.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchModels, type ModelEntry } from "../src/core/ai/client";
import { getProvider } from "../src/core/ai/providers";

describe("openrouter provider", () => {
  it("is registered with expected definition", () => {
    const provider = getProvider("openrouter");
    expect(provider).toBeDefined();
    expect(provider?.id).toBe("openrouter");
    expect(provider?.label).toBe("OpenRouter");
    expect(provider?.baseUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(provider?.modelUrl).toBe("https://openrouter.ai/api/v1/models");
    expect(provider?.requiresApiKey).toBe(true);
    expect(provider?.defaultModel).toBe("anthropic/claude-3.5-sonnet");
  });
});

describe("fetchModels response parsing", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("maps id+name responses to { id, label: name } entries", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
            { id: "openai/gpt-5.4-mini", name: "GPT-5.4 Mini" }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await fetchModels({
      modelUrl: "https://openrouter.ai/api/v1/models",
      apiKey: "sk-test"
    });

    expect("error" in result).toBe(false);
    expect(result.models).toEqual<ModelEntry[]>([
      { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" }
    ]);
  });

  it("falls back to id as label when name is missing", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { id: "gpt-5.4-mini" },
            { id: "gpt-5.4" }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const result = await fetchModels({
      modelUrl: "https://api.openai.com/v1/models",
      apiKey: "sk-test"
    });

    expect("error" in result).toBe(false);
    expect(result.models).toEqual<ModelEntry[]>([
      { id: "gpt-5.4", label: "gpt-5.4" },
      { id: "gpt-5.4-mini", label: "gpt-5.4-mini" }
    ]);
  });

  it("returns error on empty data array", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const result = await fetchModels({
      modelUrl: "https://api.openai.com/v1/models",
      apiKey: "sk-test"
    });

    expect(result).toEqual({ error: "No models returned by the provider." });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/openrouter-provider.test.ts`
Expected: FAIL — `ModelEntry` import not found, and the current `fetchModels` returns `string[]` so `result.models[0].label` is undefined and the equality check fails.

- [x] **Step 3: Update type and implementation in `client.ts`**

Edit `src/core/ai/client.ts`:

At the top of the file (near the existing `ModelsResponseBody` type around line 33), replace:

```typescript
type ModelsResponseBody = ProviderErrorPayload & {
  data?: Array<{ id?: unknown }>;
};
```

with:

```typescript
type ModelsResponseBody = ProviderErrorPayload & {
  data?: Array<{ id?: unknown; name?: unknown }>;
};

export type ModelEntry = { id: string; label: string };
```

Then replace the `fetchModels` signature and parsing block (current lines ~499–550):

```typescript
export async function fetchModels(input: {
  modelUrl: string; // URL endpoint lấy danh sách model
  apiKey?: string; // API key (nếu cần)
  headers?: Record<string, string>;
  sessionId?: string;
}): Promise<{ models: string[] } | { error: string }> {
  try {
    const response = await fetchWithTimeout(input.modelUrl, {
      headers: resolveRequestHeaders({
        baseUrl: input.modelUrl,
        apiKey: input.apiKey,
        includeJson: false,
        headers: input.headers,
        sessionId: input.sessionId,
      }),
    });

    // Xử lý lỗi HTTP
    if (!response.ok) {
      let msg = `HTTP ${response.status}.`;
      try {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text) as ProviderErrorPayload | null;
          if (parsed?.error?.message) msg = parsed.error.message;
        } catch {
          if (text && text.length < 200) msg = text;
        }
      } catch {}
      return { error: msg };
    }

    // Parse JSON
    let body: ModelsResponseBody;
    try {
      body = (await response.json()) as ModelsResponseBody;
    } catch {
      return { error: "Provider returned a non-JSON models response." };
    }

    // Trích xuất danh sách model từ body.data (theo chuẩn OpenAI API)
    // Lọc bỏ giá trị rỗng, loại bỏ trùng lặp, sắp xếp A-Z
    const models: string[] = Array.from(
      new Set(
        (body?.data ?? [])
          .map((model) => (typeof model.id === "string" ? model.id.trim() : ""))
          .filter(Boolean),
      ),
    ).sort();

    if (models.length === 0)
      return { error: "No models returned by the provider." };
    return { models };
  } catch (error) {
    const msg =
      error instanceof TypeError
        ? "Could not reach the provider. Check the URL."
        : error instanceof Error
          ? error.message
          : "Unknown error.";
    return { error: msg };
  }
}
```

Replace with:

```typescript
export async function fetchModels(input: {
  modelUrl: string; // URL endpoint lấy danh sách model
  apiKey?: string; // API key (nếu cần)
  headers?: Record<string, string>;
  sessionId?: string;
}): Promise<{ models: ModelEntry[] } | { error: string }> {
  try {
    const response = await fetchWithTimeout(input.modelUrl, {
      headers: resolveRequestHeaders({
        baseUrl: input.modelUrl,
        apiKey: input.apiKey,
        includeJson: false,
        headers: input.headers,
        sessionId: input.sessionId,
      }),
    });

    // Xử lý lỗi HTTP
    if (!response.ok) {
      let msg = `HTTP ${response.status}.`;
      try {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text) as ProviderErrorPayload | null;
          if (parsed?.error?.message) msg = parsed.error.message;
        } catch {
          if (text && text.length < 200) msg = text;
        }
      } catch {}
      return { error: msg };
    }

    // Parse JSON
    let body: ModelsResponseBody;
    try {
      body = (await response.json()) as ModelsResponseBody;
    } catch {
      return { error: "Provider returned a non-JSON models response." };
    }

    // Trích xuất danh sách model từ body.data (theo chuẩn OpenAI API)
    // Map mỗi entry thành { id, label }; label ưu tiên `name`, fallback về `id`
    // Lọc bỏ entry thiếu id, loại bỏ trùng lặp, sắp xếp theo id A-Z
    const models: ModelEntry[] = Array.from(
      new Map(
        (body?.data ?? [])
          .map((entry) => {
            const id = typeof entry.id === "string" ? entry.id.trim() : "";
            if (!id) return null;
            const name = typeof entry.name === "string" ? entry.name.trim() : "";
            return { id, label: name || id } as ModelEntry;
          })
          .filter((entry): entry is ModelEntry => entry !== null),
      ).values(),
    ).sort((a, b) => a.id.localeCompare(b.id));

    if (models.length === 0)
      return { error: "No models returned by the provider." };
    return { models };
  } catch (error) {
    const msg =
      error instanceof TypeError
        ? "Could not reach the provider. Check the URL."
        : error instanceof Error
          ? error.message
          : "Unknown error.";
    return { error: msg };
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/openrouter-provider.test.ts`
Expected: PASS (4/4).

- [x] **Step 5: Run type check**

Run: `npm run compile`
Expected: FAIL — `LoadModelsResponse` and background.ts still expect `string[]`. That's expected and addressed in Task 3.

- [x] **Step 6: Commit**

```bash
git add src/core/ai/client.ts tests/openrouter-provider.test.ts
git commit -m "feat(ai): return ModelEntry list from fetchModels"
```

---

## Task 3: Wire `LoadModelsResponse` And Background Handler To `ModelEntry[]`

**Files:**
- Modify: `src/core/messaging/types.ts:101-103`
- Modify: `entrypoints/background.ts:273-285` (LOAD_MODELS handler)

**Interfaces:**
- Consumes: `ModelEntry` type from `src/core/ai/client.ts`.
- Produces: `LoadModelsResponse = { ok: true; models: ModelEntry[] } | { ok: false; error: string }` flowing through background handler unchanged.

- [x] **Step 1: Update `LoadModelsResponse` type**

In `src/core/messaging/types.ts`, at the top with other type imports (around line 1–8), add:

```typescript
import type { ModelEntry } from "../ai/client";
```

Then replace the existing definition (lines 101–103):

```typescript
export type LoadModelsResponse =
  | { ok: true; models: string[] }
  | { ok: false; error: string };
```

with:

```typescript
export type LoadModelsResponse =
  | { ok: true; models: ModelEntry[] }
  | { ok: false; error: string };
```

- [x] **Step 2: Run type check**

Run: `npm run compile`
Expected: FAIL — `entrypoints/background.ts` line 281 returns `{ ok: true as const, models: result.models }` which is already correct; but `SettingsPanel` uses `response.models.includes(current)` which won't typecheck against `ModelEntry[]`. That's expected — Task 5 fixes SettingsPanel.

- [x] **Step 3: Confirm background handler needs no change**

Open `entrypoints/background.ts` around lines 273–285. The handler already does:

```typescript
const result = await fetchModels({
  modelUrl: runtime.config.modelUrl,
  apiKey: runtime.config.apiKey,
  headers: getProviderHeaders(runtime.config.providerId),
});
if ("models" in result)
  return { ok: true as const, models: result.models };
return { ok: false as const, error: result.error };
```

This is already correct because both the new and old `fetchModels` return a `result.models` array — the handler passes it through. No edit needed.

If you needed to confirm the type check passes for `background.ts` alone, temporarily comment out the failing SettingsPanel import and re-run `npx tsc --noEmit entrypoints/background.ts`. Revert the comment before committing.

- [x] **Step 4: Run the test from Task 2 to confirm contract**

Run: `npm test -- --run tests/openrouter-provider.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/messaging/types.ts
git commit -m "feat(messaging): ModelEntry[] in LoadModelsResponse"
```

---

## Task 4: Build The Autocomplete Component

**Files:**
- Create: `entrypoints/sidepanel/components/Autocomplete.tsx`
- Test: `tests/autocomplete.test.tsx` (new file)

**Interfaces:**
- Consumes: nothing — leaf component.
- Produces: exported `Autocomplete` component and `AutocompleteOption` type used by SettingsPanel in Task 5.

- [x] **Step 1: Write the failing test**

Create `tests/autocomplete.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Autocomplete, type AutocompleteOption } from "../entrypoints/sidepanel/components/Autocomplete";

const options: AutocompleteOption[] = [
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", hint: "anthropic/claude-3.5-sonnet" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "google/gemini-pro", label: "Gemini Pro" }
];

describe("Autocomplete", () => {
  it("renders the selected option's label in the input", () => {
    render(<Autocomplete id="ac" value="openai/gpt-5.4-mini" options={options} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("GPT-5.4 Mini");
  });

  it("opens the listbox with all options when clicked", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(3);
  });

  it("filters options by label (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("claude");

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(1);
    expect(within(listbox).getByRole("option")).toHaveTextContent("Claude 3.5 Sonnet");
  });

  it("filters options by id when label does not match", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("gemini");

    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(1);
    expect(within(listbox).getByRole("option")).toHaveTextContent("Gemini Pro");
  });

  it("moves highlight with ArrowDown / ArrowUp", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");
    const first = within(listbox).getAllByRole("option")[0];
    expect(first).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    const second = within(listbox).getAllByRole("option")[1];
    expect(second).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}");
    expect(first).toHaveAttribute("aria-selected", "true");
  });

  it("commits highlighted option on Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Autocomplete id="ac" value="" options={options} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("openai/gpt-5.4-mini");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes without changing value on Escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Autocomplete id="ac" value="openai/gpt-5.4-mini" options={options} onChange={onChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("GPT-5.4 Mini");
  });

  it("closes on click outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button data-testid="outside">Outside</button>
        <Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />
      </div>
    );

    await user.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.click(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} disabled />);

    await user.click(screen.getByRole("combobox"));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows skeleton when loading", () => {
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} loading />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByTestId("autocomplete-skeleton")).toBeInTheDocument();
  });

  it("renders hint when present and different from label", async () => {
    const user = userEvent.setup();
    render(<Autocomplete id="ac" value="" options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));
    const row = screen.getByRole("option", { name: /Claude 3\.5 Sonnet/ });
    expect(within(row).getByText("anthropic/claude-3.5-sonnet")).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/autocomplete.test.tsx`
Expected: FAIL — module `Autocomplete` not found.

- [x] **Step 3: Implement the component**

Create `entrypoints/sidepanel/components/Autocomplete.tsx`:

```tsx
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface AutocompleteOption {
  id: string;
  label: string;
  hint?: string;
}

export interface AutocompleteProps {
  id: string;
  value: string;
  options: AutocompleteOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}

function ChevronIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function Autocomplete(props: AutocompleteProps) {
  const { id, value, options, onChange, placeholder, disabled, loading, emptyMessage } = props;
  const reactId = useId();
  const listboxId = `${id}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value),
    [options, value]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.id.toLowerCase().includes(needle)
    );
  }, [options, query]);

  // Reset highlight when filter result changes
  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  if (loading) {
    return (
      <div
        data-testid="autocomplete-skeleton"
        className="h-[46px] w-full animate-pulse rounded-xl bg-warm-bg border border-stone-850"
        aria-hidden="true"
      />
    );
  }

  function commit(option: AutocompleteOption) {
    onChange(option.id);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return;
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      const choice = filtered[highlight];
      if (choice) commit(choice);
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setQuery("");
      }
    } else if (event.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  }

  const displayedValue = open ? query : selectedOption?.label ?? "";

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filtered[highlight] ? `${reactId}-option-${filtered[highlight].id}` : undefined
        }
        className="w-full rounded-xl border border-stone-850 bg-warm-bg px-3.5 py-3 text-[13.5px] font-medium text-stone-100 outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/45 transition-colors shadow-inner disabled:opacity-50"
        value={displayedValue}
        placeholder={selectedOption ? selectedOption.label : placeholder}
        disabled={disabled}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      <ChevronIcon />
      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-800 bg-warm-bg shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3.5 py-2.5 text-xs text-stone-500">{emptyMessage ?? "Không có kết quả."}</li>
          ) : (
            filtered.map((option, index) => {
              const isHighlight = index === highlight;
              const isSelected = option.id === value;
              const showHint = option.hint && option.hint !== option.label;
              return (
                <li
                  key={option.id}
                  id={`${reactId}-option-${option.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => {
                    // mousedown so we beat the input blur
                    event.preventDefault();
                    commit(option);
                  }}
                  className={`flex flex-col gap-0.5 px-3.5 py-2 text-[13px] cursor-pointer ${
                    isHighlight ? "bg-stone-800/60" : ""
                  } ${isSelected ? "bg-primary/15 text-primary" : "text-stone-100"}`}
                >
                  <span className="font-medium">{option.label}</span>
                  {showHint ? <span className="text-[11px] text-stone-500">{option.hint}</span> : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/autocomplete.test.tsx`
Expected: PASS (11/11). If a test fails because `placeholder` differs from `selectedOption.label` causing an empty `value`, re-check that `displayedValue` falls back to `""` when `selectedOption` is missing.

- [x] **Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: PASS for all non-SettingsPanel tests. SettingsPanel tests will fail because `response.models` is now `ModelEntry[]` — Task 5 fixes that.

- [x] **Step 6: Commit**

```bash
git add entrypoints/sidepanel/components/Autocomplete.tsx tests/autocomplete.test.tsx
git commit -m "feat(ui): add Autocomplete combobox component"
```

---

## Task 5: Integrate Autocomplete Into SettingsPanel

**Files:**
- Modify: `entrypoints/sidepanel/components/SettingsPanel.tsx` (state type, two `<select>` swaps, helpers)

**Interfaces:**
- Consumes: `Autocomplete`, `AutocompleteOption`, `ModelEntry` from prior tasks.
- Produces: a SettingsPanel that renders an `Autocomplete` for provider and an `Autocomplete` for model; persists selections the same way.

- [x] **Step 1: Update imports**

In `entrypoints/sidepanel/components/SettingsPanel.tsx`, add to the top imports (after the existing line `import { getProvider, getProviderOptions } from ...`):

```typescript
import { Autocomplete, type AutocompleteOption } from "./Autocomplete";
import type { ModelEntry } from "../../../src/core/ai/client";
```

- [x] **Step 2: Change model state type and add a helper**

Find:

```typescript
const [models, setModels] = useState<string[]>(provider?.knownModels ?? []);
```

Replace with:

```typescript
const toEntry = (id: string): ModelEntry => ({ id, label: id });
const [models, setModels] = useState<ModelEntry[]>(
  (provider?.knownModels ?? []).map(toEntry)
);
```

- [x] **Step 3: Update `updateProvider` to seed models correctly**

Find the block in `updateProvider`:

```typescript
async function updateProvider(value: string) {
  const nextProvider = getProvider(value);
  const nextModels = nextProvider?.knownModels ?? [];
  setModels(nextModels);
  setModelWarning(null);
  setModelError(null);
  const nextKeys = { ...props.settings.apiKeys };
  const existingKey = props.settings.apiKeys[value] ?? "";
  setLocalApiKey(existingKey);
  await commit(createNextSettings({ providerId: value }));
}
```

Replace `const nextModels = nextProvider?.knownModels ?? [];` with:

```typescript
const nextModels = (nextProvider?.knownModels ?? []).map(toEntry);
```

And replace `setModels(nextModels);` with the same line — the assignment is unchanged because `nextModels` is now `ModelEntry[]`.

- [x] **Step 4: Update the load-models effect**

Find the load effect. The body currently does:

```typescript
setModels(knownModels);
```

Replace that one line with:

```typescript
setModels(knownModels.map(toEntry));
```

Then find:

```typescript
if (response?.ok) {
  setModels(response.models);
  setModelWarning(null);
  const current = props.settings.selectedModels[provider.id];
  const nextModel = current && response.models.includes(current)
    ? current
    : provider.defaultModel && response.models.includes(provider.defaultModel)
      ? provider.defaultModel
      : response.models[0];
  ...
}
```

Replace this entire `if (response?.ok)` block with:

```typescript
if (response?.ok) {
  setModels(response.models);
  setModelWarning(null);
  const current = props.settings.selectedModels[provider.id];
  const modelIds = response.models.map((entry) => entry.id);
  const nextModel = current && modelIds.includes(current)
    ? current
    : provider.defaultModel && modelIds.includes(provider.defaultModel)
      ? provider.defaultModel
      : response.models[0]?.id;
  if (nextModel && nextModel !== current) {
    props.onChange(createNextSettings({
      selectedModels: { ...props.settings.selectedModels, [provider.id]: nextModel }
    }));
  }
}
```

Find the `else if` and the `catch` branches:

```typescript
} else if (knownModels.length > 0) {
  setModels(knownModels);
  ...
} else {
  setModels([]);
  setModelError(response?.error ?? "Không thể tải mô hình.");
}
...
} else {
  setModels([]);
  setModelError("Không thể tải mô hình.");
}
```

Replace both `setModels(knownModels);` occurrences with:

```typescript
setModels(knownModels.map(toEntry));
```

The other lines (`setModelWarning(...)`, `setModels([])`, `setModelError(...)`) are unchanged.

- [x] **Step 5: Replace the provider `<select>` with `<Autocomplete>`**

Find the Provider Card block (around lines 197–211):

```tsx
<select
  id="provider-select"
  className="..."
  value={providerId}
  onChange={(event) => updateProvider(event.target.value)}
>
  {getProviderOptions().map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
</select>
<ChevronIcon />
```

Replace with:

```tsx
<Autocomplete
  id="provider-select"
  value={providerId}
  options={getProviderOptions()}
  onChange={updateProvider}
/>
```

- [x] **Step 6: Replace the model `<select>` with `<Autocomplete>`**

Find the Model Card block (around lines 250–266):

```tsx
{loadingModels ? (
  <ModelSkeleton />
) : (
  <select
    id="model-select"
    className="..."
    value={selectedModel}
    onChange={(event) => updateSelectedModel(event.target.value)}
    disabled={models.length === 0}
  >
    {selectedModel && !models.includes(selectedModel) ? <option value={selectedModel}>{selectedModel}</option> : null}
    {models.map((model) => <option key={model} value={model}>{model}</option>)}
  </select>
)}
{!loadingModels && <ChevronIcon />}
```

Replace with:

```tsx
<Autocomplete
  id="model-select"
  value={selectedModel}
  options={models}
  onChange={updateSelectedModel}
  loading={loadingModels}
  disabled={models.length === 0 && !selectedModel}
  emptyMessage={modelError ?? "Không có mô hình nào."}
/>
```

The `ModelSkeleton` import is still used — leave it imported for now; the typecheck will tell us if it's dead. (You'll remove it in Step 8 if nothing uses it.)

- [x] **Step 7: Run type check**

Run: `npm run compile`
Expected: exit code 0. If TypeScript complains about unused `ChevronIcon` import, leave it for Step 8; if it complains about a real mismatch, fix the call site.

- [x] **Step 8: Clean up unused `ModelSkeleton`**

`ChevronIcon` is still used by the Thinking `<select>` card further down in the same file — leave it. `ModelSkeleton` was only referenced by the model `<select>` loading branch and is now dead code. Remove the `ModelSkeleton` function definition (the `function ModelSkeleton() { return <div ... />; }` block, roughly 2 lines). Also remove its call site — Step 6's `loading` prop on `<Autocomplete>` already replaces it.

Re-run `npm run compile` to confirm.

- [x] **Step 9: Update existing SettingsPanel tests**

Open `tests/sidepanel-settings.test.tsx`. The current assertions rely on `<select>` exposing its `<option>` children as accessible options:

```typescript
expect(screen.getByRole("option", { name: "OpenAI" })).toBeInTheDocument();
expect(screen.getByRole("option", { name: "LMStudio" })).toBeInTheDocument();
```

The Autocomplete only exposes options when its listbox is open. Rewrite the affected test ("renders bundled providers and removes manual base url UI") to open the provider combobox first:

```typescript
it("renders bundled providers and removes manual base url UI", async () => {
  const user = userEvent.setup();
  render(<SettingsPanel settings={settings()} onChange={vi.fn()} />);

  expect(screen.getByLabelText(/Nhà cung cấp/i)).toBeInTheDocument();

  await user.click(screen.getByRole("combobox", { name: /Nhà cung cấp/i }));
  expect(screen.getByRole("option", { name: "OpenAI" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "LMStudio" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "OpenRouter" })).toBeInTheDocument();

  expect(screen.queryByLabelText(/Base URL/i)).not.toBeInTheDocument();
});
```

Skim the rest of the file for any other `getByRole("option", ...)`, `select` selectors, or assertions about the model `<select>` (e.g. "selecting a model persists"). For each one, convert it to:
1. `await user.click(screen.getByRole("combobox", { name: /Mô hình/i }))` to open the model listbox.
2. Then `await user.click(screen.getByRole("option", { name: ... }))` to select.

There should be no more than 1–2 such tests in this file based on the existing code style. If you find one and need to assert `onChange` was called with the chosen model id, the assertion body stays identical because `updateSelectedModel` still receives a plain `string` (the option `id`).

Run: `npm test -- --run tests/sidepanel-settings.test.tsx`
Expected: PASS.

- [x] **Step 10: Run full test suite**

Run: `npm test -- --run`
Expected: PASS for every test file. If `sidepanel-app.test.tsx` or another consumer breaks because it expected `string[]`, search for any direct consumer of `LoadModelsResponse` and update accordingly.

- [x] **Step 11: Commit**

```bash
git add entrypoints/sidepanel/components/SettingsPanel.tsx tests/sidepanel-settings.test.tsx
git commit -m "feat(settings): swap selects for Autocomplete, support ModelEntry[]"
```

---

## Task 6: Final Verification

**Files:**
- Read-only checks; no edits.

- [x] **Step 1: Type check**

Run: `npm run compile`
Expected: exit code 0, no diagnostics.

- [x] **Step 2: Full test suite**

Run: `npm test -- --run`
Expected: every test file passes.

- [x] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds; `.output/chrome-mv3/manifest.json` is produced. Skim the output for errors but do not commit build artifacts.

- [x] **Step 4: Smoke check provider list**

Run: `node -e "import('./src/core/ai/providers.ts').catch(()=>{}).then(()=>console.log('skip ts'))"`
Expected: skip message (TS files don't run directly in node). Instead, verify visually by running `npm test -- --run tests/openrouter-provider.test.ts` and confirming all 4 assertions pass.

- [x] **Step 5: Manual sanity (optional)**

Run: `npm run dev`
Then load `.output/chrome-mv3/` as an unpacked extension in Chrome, open the side panel, click the provider dropdown, confirm OpenRouter appears, select it, type a key, and confirm the model list loads. This is a developer sanity step; no automation captures it.

- [x] **Step 6: Final commit (if any cleanup landed in this task)**

```bash
git status
git add -A
git commit -m "chore: post-integration cleanup" --allow-empty
```

Only run this commit if Step 1–5 surfaced something to fix. Otherwise the work is already on the branch from Task 5.
