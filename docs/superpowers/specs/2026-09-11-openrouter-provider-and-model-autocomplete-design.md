# OpenRouter Provider And Model Autocomplete Design

## Status

Approved for spec creation on 2026-09-11.

## Motivation

The extension ships four AI providers (OpenAI, OpenCode, CommandCode, LMStudio) but offers no access to OpenRouter — a unified gateway that fronts hundreds of models (Anthropic, OpenAI, Google, Meta, Mistral, etc.) behind one OpenAI-compatible API and one billing account. Users who already pay for OpenRouter cannot use it through this extension.

Equally important, the Settings panel uses a plain `<select>` dropdown for both providers and models. With OpenRouter's 200+ models this becomes a wall of alphabetically-sorted IDs with no way to search. Even the four existing providers would benefit from a combobox with type-to-filter.

This change adds OpenRouter as a fifth provider and replaces both `<select>` elements with a reusable Autocomplete component.

## Goals

- Add OpenRouter as a provider with `requires_api_key: true` and `default_model: "anthropic/claude-3.5-sonnet"`.
- Show OpenRouter models as "Name (id)" so users can read the human-readable name while still seeing the technical ID.
- Build a reusable `Autocomplete` component that replaces both `<select>` elements in SettingsPanel (provider and model selection).
- Autocomplete supports keyboard navigation (Arrow Up/Down, Enter, Escape), click-outside close, and case-insensitive substring filter on both `label` and `id`.
- Preserve existing behavior: persisted selected model, fallback to `known_models` when fetch fails, no fetch when API key is missing for a key-requiring provider.
- Add unit tests for the Autocomplete component (open/close/filter/keyboard) and for OpenRouter provider parsing.
- No visual refactor of SettingsPanel beyond what is required to swap in the new component.

## Non-Goals

- Changing the chat-completions request format for non-OpenRouter providers.
- Adding provider-specific features to OpenRouter (e.g. app attribution headers, tool routing, free-model filtering).
- Caching the fetched models list — Settings already re-fetches on provider/key change.
- Supporting async search (loading more models on scroll).
- Removing any existing provider.
- Changing persistence shape (`Settings` type, `selectedModels` map) — both `providerId` and the per-provider `selectedModels[id]` continue to store plain strings.

## Provider Registry

Add a fifth entry to `src/core/ai/providers.json`:

```json
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

Rationale:

- `requires_api_key: true` matches existing key-requiring providers. Loading models without a key is possible on OpenRouter but rejected for consistency — users add a key once and the same code path works for all providers.
- `known_models: []` because OpenRouter's model catalog rotates too often for a bundled list. If fetch fails the dropdown will simply be empty (with the existing red error message), which is honest.
- `default_model` is a sane starting point if a user adds an OpenRouter key without ever fetching models.

## Model Fetch Response

OpenRouter returns `{ data: [{ id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", ... }, ...] }`. The current `fetchModels` implementation already extracts `body.data[i].id` correctly, but discards `name`.

Extend the function to return objects, not strings, so the UI can show both:

```typescript
export type ModelEntry = { id: string; label: string };

export async function fetchModels(input: {
  modelUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  sessionId?: string;
}): Promise<{ models: ModelEntry[] } | { error: string }>;
```

Mapping rule when parsing the response:

- If `entry.name` is a non-empty string → `label = name`, `id = entry.id`.
- Otherwise → `label = id = entry.id` (fallback for providers that only ship IDs).

This preserves backward compatibility with OpenAI / OpenCode / CommandCode / LMStudio responses (their items have no `name`, so label collapses to id — visually identical to today).

`LoadModelsResponse` in `src/core/messaging/types.ts` changes from `string[]` to `ModelEntry[]`. Background handler passes the array through unchanged.

## Autocomplete Component

### File

`entrypoints/sidepanel/components/Autocomplete.tsx`

### Public Types

```typescript
export interface AutocompleteOption {
  id: string;          // unique, used as React key and stored value
  label: string;       // primary display text
  hint?: string;       // secondary line (e.g. model id); omitted when label already includes it
}

export interface AutocompleteProps {
  id: string;                                // DOM id for the input
  value: string;                             // currently selected id (controlled)
  options: AutocompleteOption[];             // full option list
  onChange: (value: string) => void;         // called when user selects an option
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;                         // shows skeleton instead of input
  emptyMessage?: string;                     // shown when filter yields zero results
}
```

### Behavior

- **Closed state**: renders an `<input>` showing the label of the currently selected option (or `placeholder` when empty). A chevron icon on the right signals the dropdown.
- **Open state**: a positioned panel below the input listing filtered options. Each row shows `label` on the first line and `hint` (if present and different from label) muted on a second line.
- **Opening**: focus or click on the input opens the panel. The full option list is shown (no filter yet) and the first option is highlighted.
- **Filtering**: typing filters options case-insensitively against both `label` and `id` (substring match). Empty input restores the full list.
- **Keyboard**:
  - `ArrowDown` / `ArrowUp`: move highlight.
  - `Enter`: commit highlighted option (closes panel).
  - `Escape`: close panel without changing value, return focus to input.
  - `Tab`: close panel without changing value.
- **Mouse**: click an option to select; click outside to close.
- **Disabled**: input is non-interactive, no panel.
- **Loading**: renders a skeleton block identical in size to the input (reuses the visual rhythm of `ModelSkeleton`).
- **Value synchronization**: when `value` prop changes externally (e.g. provider switch) and the new id is not in `options`, the input displays `value` verbatim so the user sees what is actually stored.

### Accessibility

- Input has `role="combobox"`, `aria-expanded`, `aria-controls` pointing at the panel id, `aria-autocomplete="list"`, `aria-activedescendant` pointing at the highlighted row.
- Panel has `role="listbox"`, options have `role="option"` with `aria-selected`.
- Focus trap is not required — Escape/Tab both close and return focus to the input.

### Visual Style

Matches the existing SettingsPanel inputs: `rounded-xl border border-stone-850 bg-warm-bg`, focus ring `focus:border-primary/80 focus:ring-1 focus:ring-primary/45`. Selected option row uses `bg-primary/15`. Highlight row uses `bg-stone-800/60`. Max-height with `overflow-y-auto` for long lists.

## SettingsPanel Integration

Changes are confined to two `<select>` swaps and one state type change. Nothing else is touched.

### State

- Replace `useState<string[]>(provider?.knownModels ?? [])` with `useState<ModelEntry[]>(provider?.knownModels.map(toEntry) ?? [])`.
- Add a `toEntry(id: string): ModelEntry` helper colocated in the file: `toEntry = (id) => ({ id, label: id })`.

### Provider `<select>` → `<Autocomplete>`

Provider options come from `getProviderOptions()` (already `{ id, label }[]` shape, fits `AutocompleteOption` directly). `onChange` receives the chosen provider id and runs the existing `updateProvider` flow unchanged.

### Model `<select>` → `<Autocomplete>`

- `options = models` (now `ModelEntry[]`).
- `onChange = updateSelectedModel`.
- `value = selectedModel`.
- `loading = loadingModels`.
- `emptyMessage = modelError ?? "Không có mô hình nào."` (Vietnamese matches existing UI strings).

The current logic that keeps a `selectedModel` not in the new list (the "ghost option" pattern in the existing `<select>`) is no longer needed — the Autocomplete shows `value` verbatim when no match exists, which is the same outcome with less code.

The fallback chain when fetch returns and the current model is missing (`knownModels` → `defaultModel` → first fetched) stays intact, only operating on `entry.id` instead of `string`.

The model warning/error messages (`modelWarning`, `modelError`) are preserved exactly.

## Testing

### New: `tests/autocomplete.test.tsx`

Uses `@testing-library/react`, `userEvent`, and the existing jsdom setup. Covers:

1. Renders the selected option's label in the input.
2. Clicking the input opens the listbox with all options.
3. Typing filters options by label (case-insensitive).
4. Typing filters options by id when label does not match.
5. ArrowDown / ArrowUp move highlight.
6. Enter commits highlighted option and closes the panel.
7. Escape closes without changing value.
8. Click outside closes the panel.
9. Disabled prop prevents opening.
10. Loading prop shows skeleton instead of input.
11. `hint` is rendered when present and different from label.

### New: `tests/openrouter-provider.test.ts`

Uses the existing Vitest setup. Covers:

1. `getProvider("openrouter")` returns a valid `ProviderDefinition`.
2. The returned definition has `requiresApiKey: true`, expected URLs, `defaultModel: "anthropic/claude-3.5-sonnet"`.
3. `normalizeProviders` accepts a payload that includes an OpenRouter entry alongside the existing four.
4. `fetchModels` mapping: a response containing both `id` and `name` produces `{ id, label: name }`; a response containing only `id` produces `{ id, label: id }`.

### Existing tests

No changes expected. The existing `LoadModelsResponse` consumers are limited to the background handler and SettingsPanel, both of which are updated in lockstep.

## Files Changed

| File | Change |
|------|--------|
| `src/core/ai/providers.json` | Add OpenRouter entry |
| `src/core/ai/client.ts` | `fetchModels` returns `ModelEntry[]` instead of `string[]`; export `ModelEntry` |
| `src/core/messaging/types.ts` | `LoadModelsResponse` carries `ModelEntry[]` |
| `entrypoints/background.ts` | Pass-through type change in LOAD_MODELS handler |
| `entrypoints/sidepanel/components/Autocomplete.tsx` | **New** |
| `entrypoints/sidepanel/components/SettingsPanel.tsx` | Swap two `<select>` for `<Autocomplete>`, adjust model state to `ModelEntry[]` |
| `tests/autocomplete.test.tsx` | **New** |
| `tests/openrouter-provider.test.ts` | **New** |

## Out of Scope / Future Work

- Token streaming and AbortController tweaks specific to OpenRouter.
- Displaying pricing, context length, or modality badges next to each model.
- Persisting user-pinned models across provider switches.
- A dedicated OpenRouter free-model filter toggle.
