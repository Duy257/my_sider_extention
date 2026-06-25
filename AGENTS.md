# AGENTS.md

## Project Overview

Chrome Manifest V3 browser extension (Personal AI Sidebar) — private AI assistant for reading, rewriting, summarizing, and analysis workflows. Built with WXT + React 19 + TypeScript + Tailwind CSS. Uses BYOK (Bring Your Own API Key) model — no backend server.

- **Framework**: [WXT](https://wxt.dev) (Vite-based browser extension framework)
- **UI**: React 19 + Tailwind CSS 3
- **Language**: TypeScript 5 (strict mode)
- **Testing**: Vitest + jsdom + React Testing Library
- **AI Providers**: OpenAI, OpenCode, CommandCode, LMStudio (extensible via `providers.json`)
- **Storage**: `chrome.storage.local` with versioned envelopes (`schemaVersion` + `data`)
- **Supported browsers**: Chrome (primary), Firefox

## Architecture

```
entrypoints/
├── background.ts          — Service worker: streaming AI chat, page extraction, selection routing
├── active-tab-agent.ts    — Content script (injected on demand): selection toolbar, page extraction
└── sidepanel/             — Side panel React app
    ├── App.tsx            — Root component with state management
    ├── main.tsx           — React entry point
    ├── styles.css         — Tailwind imports + global styles
    └── components/        — ChatComposer, ChatMessage, HeaderBar, SettingsPanel, PromptManager, SavedResults, etc.
src/
├── lib/
│   ├── ai/                — client.ts (stream/fetch), providers.ts (registry), runtime.ts (config resolver), stream.ts (error mapping), providers.json
│   ├── extraction/        — index.ts (orchestrator), readability.ts (via @mozilla/readability), fallback.ts (DOM text)
│   ├── messaging/         — ports.ts, types.ts (all message type definitions)
│   ├── prompts/           — builders.ts (system/user prompt builders), seeds.ts (default templates), types.ts
│   ├── selection/         — types.ts, actions.ts (action definitions), toolbar.ts (floating UI)
│   └── storage/           — index.ts (CRUD), defaults.ts, migrations.ts, types.ts
└── types/
    └── window.d.ts        — Global type augmentations
tests/                     — Vitest test files (mirrors src/ structure)
```

### Communication Flow

1. User types in side panel → `chrome.runtime.connect({ name: "ai-stream" })` → Port-based streaming
2. User selects text on page → content script shows floating toolbar → `chrome.runtime.sendMessage` → background routes back to side panel
3. User clicks "Read page" → background injects `active-tab-agent.js` → `tabs.sendMessage({ type: "EXTRACT_PAGE_CONTENT" })` → result forwarded to side panel

## Setup Commands

```sh
npm install          # Install dependencies (also runs `wxt prepare` via postinstall)
npm run dev          # Start WXT dev server (HMR, Chrome)
npm run dev:firefox  # Start WXT dev server (HMR, Firefox)
npm run build        # Production build → .output/chrome-mv3/
npm run build:firefox# Production build → .output/firefox-mv3/
npm run zip          # Package extension for Chrome Web Store
npm run zip:firefox  # Package extension for Firefox
```

## Testing Instructions

- **Run all tests**: `npm test`
- **Watch mode**: `npm test -- --watch`
- **Run specific test file**: `npm test -- tests/prompt-manager.test.tsx`
- **Run tests matching pattern**: `npm vitest run -t "renders the sidebar"`
- **Test environment**: jsdom (configured in `vitest.config.ts`)
- **Test setup**: `tests/setup.ts` — globally mocks `chrome.*` API (runtime, storage, tabs, scripting, sidePanel)
- **Test location**: `tests/**/*.test.ts` or `tests/**/*.test.tsx`
- **Framework**: Vitest + `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event`
- **Chrome API**: Global mocks in `tests/setup.ts` — `createListenerContainer()` for event-based patterns, `portEntries` for port lifecycle testing

### Mocking Guidelines

- Chrome runtime APIs are globally mocked in `tests/setup.ts`
- For port-based streaming tests, use `portEntries` to access active port's `onMessage`/`onDisconnect` containers
- Use `vi.fn()` for individual mock customization per test

## Code Style

- **Language**: TypeScript 5 with strict options, `jsx: "react-jsx"`
- **Naming**: camelCase for variables/functions, PascalCase for components/types, UPPER_SNAKE for constants
- **Imports**: Explicit named imports; relative paths (e.g., `../../src/lib/ai/providers`)
- **Exports**: Prefer named exports over default exports
- **React**: Functional components with hooks, no class components
- **Styling**: Tailwind CSS utility classes (see `tailwind.config.ts` for custom colors: `warm-bg`, `surface`, `primary`, etc.)
- **Formatting**: No Prettier config found — match existing code style (2-space indentation from the look of files)
- **UI language**: Vietnamese (vi) — all user-facing strings are in Vietnamese
- **Error handling**: Use discriminated unions (`{ ok: true; data: T } | { ok: false; error: string }`) for operation results
- **Type safety**: Define types in dedicated `types.ts` files colocated with their modules
- **Storage pattern**: All persisted data uses `StorageEnvelope<T>` with `schemaVersion` for migrations

## Build and Deployment

- **Build output**: `.output/chrome-mv3/` (Chrome), `.output/firefox-mv3/` (Firefox)
- **Output structure**: `manifest.json`, `background.js`, `sidepanel.html`, `active-tab-agent.js`, `chunks/`, `assets/`
- **Type checking**: `npm run compile` (runs `tsc --noEmit`)
- **Generated files**: `.wxt/` is gitignored (WXT generates tsconfig and build artifacts here)
- **Install locally**: Load unpacked extension from `.output/chrome-mv3/` in `chrome://extensions` (Developer mode)

## AI Provider Configuration

- Providers are defined in `src/lib/ai/providers.json`
- Each provider has: `id`, `label`, `base_url`, `model_url`, `requires_api_key`, `default_model`, `known_models`
- Models are auto-fetched from `model_url` at runtime in Settings UI
- API keys are stored locally in `chrome.storage.local` — never sent to any server except the AI provider
- To add a new provider: add entry to `providers.json` and optionally extend UI in `SettingsPanel.tsx`

## Security Notes

- Extension only injects content script when user explicitly triggers an action (Read page, or open side panel which activates the agent)
- No auto-reading of every tab
- API keys stored only in `chrome.storage.local` — no backend server
- Host permissions limited to `https://api.openai.com/*`, `https://*/*` (for content scripts), `http://localhost/*`, `http://127.0.0.1/*`

## Pull Request Guidelines

- Title format: `[component] Brief description`
- Before submitting: run `npm run compile` (type check) and `npm test` (all tests pass)
- Keep changes focused — this is a personal tool, avoid scope creep

## Common Gotchas

- **Port reconnection**: The `AI_STREAM_PORT` is closed after each response — a new port is created per user message
- **Content script injection**: The `active-tab-agent.ts` content script is injected only when `ACTIVATE_ACTIVE_TAB_AGENT` is sent; it sets `window.__personalAiSidebarAgentInstalled` to prevent duplicate injection
- **Storage migrations**: `StorageEnvelope<T>` with `schemaVersion` — always update `CURRENT_SCHEMA_VERSION` in `migrations.ts` when changing storage shape
- **Selection toolbar**: Requires minimum 20 chars and maximum 20,000 chars; toolbar is positioned with `position: fixed`, destroyed on scroll/resize/click-outside/Escape
- **Page extraction**: Falls back from Readability.js → DOM text extraction; content truncated at 40,000 chars
