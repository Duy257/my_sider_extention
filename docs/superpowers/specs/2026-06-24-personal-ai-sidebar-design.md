# Personal AI Sidebar Design

## Status

Approved for design/spec creation on 2026-06-24.

## Product Positioning

This project is a private Chrome/Chromium extension for a personal AI sidebar at work. It is not intended to clone Sider or become a public SaaS product in the MVP. The product goal is to let the user read, understand, rewrite, analyze, and turn browser content into action without copying text manually into ChatGPT.

The MVP is a private local extension. It has no backend, no account system, no team features, no analytics, and no Chrome Web Store publishing requirement.

## MVP Decisions

- Browser target: Chrome/Chromium first.
- Extension platform: Manifest V3.
- Framework: WXT + React + TypeScript + Tailwind.
- AI provider: OpenAI only in the MVP.
- API model: bring your own OpenAI API key.
- Response mode: streaming responses.
- Main UI model: chat-first side panel.
- Page reading: reader-mode extraction with a DOM text fallback.
- Selection UX: floating mini toolbar shown near selected text after the tab has been activated for the extension.
- Prompt templates: full CRUD in the MVP.
- Persistence: save pinned/saved AI results only; do not persist full chat history.
- Model configuration: preset model choices plus a custom model input.

## Architecture

The extension has three main entrypoints:

- `entrypoints/sidepanel`: React application for chat, page actions, prompt templates, saved results, and settings.
- `entrypoints/background`: Manifest V3 service worker for OpenAI calls, streaming orchestration, storage access, and typed message routing.
- `entrypoints/content`: page extraction, selection detection, floating toolbar rendering, and safe communication with the extension runtime.

Shared code should live under `src/lib`:

- `src/lib/storage`: typed wrapper around `chrome.storage.local`.
- `src/lib/ai/openai`: OpenAI streaming client and error mapping.
- `src/lib/ai/types`: provider-neutral AI request and response types.
- `src/lib/extraction`: reader-mode extractor and fallback DOM text extractor.
- `src/lib/prompts`: built-in prompt seeds, prompt builders, selection action prompts.
- `src/lib/messaging`: typed message contracts between sidepanel, background, and content script.
- `src/lib/saved-results`: saved result utilities.

The UI can depend on shared libraries, but shared libraries should not depend on React. Content scripts must not receive the OpenAI API key.

The content script should be injected only into the active tab after an explicit user action, such as opening the side panel or clicking `Read page`. This keeps the MVP aligned with the privacy goal of not observing every page by default. The trade-off is intentional: the floating toolbar is available on tabs where the extension has been activated, not silently across all browsing.

The background service worker should own active-tab resolution and script injection. The side panel should request an active-tab operation from the background instead of depending on persistent `tabs` permission or storing tab identity itself.

## Security and Privacy Principles

The extension only sends content to OpenAI after an explicit user action. It must not auto-read pages, watch browsing content in the background, or send data silently.

The API key is stored in `chrome.storage.local` and read only by the background service worker when making OpenAI requests. Content scripts never receive the API key. There is no backend proxy in the MVP.

Permissions should remain conservative. The expected baseline is:

```json
{
  "permissions": ["storage", "activeTab", "sidePanel", "scripting"],
  "host_permissions": ["https://api.openai.com/*"]
}
```

The MVP should avoid global site host permissions such as `<all_urls>`. If a later implementation needs toolbar availability before the user activates the extension on a tab, that should be treated as a deliberate product/privacy change and not slipped into the MVP.

Additional permissions should be added only when required by the WXT implementation and should be justified in the implementation plan.

## Sidebar UX

The side panel opens directly into the current chat session. It should not show a landing page or marketing-style dashboard.

Primary sidebar areas:

- Header: compact controls for `Read page`, `Prompts`, `Saved`, and `Settings`.
- Main pane: chat messages and streaming responses.
- Composer: text input, send button, selected model indicator, and error state.
- Response actions: copy, save/pin, and optionally retry.

The sidebar should support these states:

- First-run setup: no API key.
- Empty chat.
- Streaming response.
- Failed response.
- Page extraction loading.
- Page extraction failed.
- Saved result list.
- Prompt template management.
- Settings.

## Prompt Templates

Prompt templates are a first-class MVP feature. The user can create, edit, delete, rename, and reorder templates.

Initial seed prompts should be derived from `docs/docs-init.md`, including:

- Rewrite in CEO style: clear, firm, no exaggeration.
- Summarize as table: Problem - Cause - Solution.
- Analyze from a business operations perspective.
- Turn this content into an action plan.
- Review technical errors as a senior developer.

Templates can be applied to current page content, selected text, or a manual chat input.

Model presets should live in a small local config file, with custom model input available for override. The implementation plan should verify current official OpenAI model names before choosing default presets, because model availability changes over time.

## Floating Selection Toolbar

After the extension is activated for a tab, the injected content script watches for stable text selections with a minimum useful length. When valid text is selected, it renders a small floating toolbar near the selection.

Selection limits:

- Minimum selected text length: 20 characters.
- Maximum selected text length sent directly: 20,000 characters.
- If selection exceeds the maximum, the toolbar should ask the side panel to show a clear "selection too long" state instead of silently truncating.

MVP actions:

- Explain.
- Translate to Vietnamese.
- Rewrite more professionally.
- Summarize.
- Convert to bullet/action list.

When an action is selected, the content script sends the selected text and action type to the extension. The background should attempt to open or focus the side panel from that user-initiated action. If Chrome does not allow the side panel to open from that path, the action should be stored as a pending request and processed when the user opens the side panel from the toolbar/icon.

The toolbar must be lightweight and isolated from the host page as much as practical. If it cannot render correctly on a site, the user can still use the side panel manually.

## Page Extraction

The `Read page` action uses a reader-mode extractor first. It should prefer a proven extraction library such as Mozilla Readability when compatible with the WXT bundle, wrapped behind the project-owned `src/lib/extraction` interface. It should attempt to identify meaningful main content from article, documentation, report, dashboard, and CRM-like pages.

Extraction behavior:

- Prefer `main`, `article`, and content-heavy regions.
- Preserve useful heading, paragraph, list, and table text.
- Remove script, style, navigation, footer, ads, and hidden content when possible.
- Include page title and URL as metadata.
- Enforce a 40,000 character maximum page context before sending to AI.
- Preserve a warning when content is truncated so the prompt can tell the model it received partial page content.
- Fall back to a basic DOM text extractor when reader-mode extraction fails.

The extractor should return a structured result with text, title, URL, extraction method, and warnings.

## AI Streaming Flow

All OpenAI requests go through the background service worker. Streaming should use a long-lived runtime `Port` between the side panel and background so request state remains connected while chunks arrive. One-off messages are acceptable for extraction requests and non-streaming commands, but not for active stream delivery.

Chat flow:

1. The user sends a message from the side panel.
2. The side panel opens a runtime `Port` and sends an `AI_CHAT_REQUEST` message to the background.
3. The background reads settings, validates the API key and model, and starts an OpenAI streaming request.
4. The background sends `AI_STREAM_CHUNK` messages over the port to the side panel.
5. The background sends `AI_STREAM_DONE` or `AI_STREAM_ERROR`.

Read page flow:

1. The user clicks `Read page`.
2. The side panel asks the background to resolve the active tab and activate the tab agent.
3. The background injects or reuses the content script in the active tab.
4. The content script returns structured page content.
5. The side panel builds a prompt using the extracted context.
6. The background streams the OpenAI response.

Selection action flow:

1. The user selects text on the page.
2. The floating toolbar appears.
3. The user chooses an action.
4. The content script sends the selected text and action to the extension.
5. The side panel opens if Chrome allows it from that user action; otherwise the request is queued as pending until the user opens the side panel.

## Message Contracts

The implementation should use typed message contracts similar to:

```ts
type SelectionAction =
  | "explain"
  | "translate_vi"
  | "rewrite_professional"
  | "summarize"
  | "action_list";

type ExtensionMessage =
  | { type: "ACTIVATE_ACTIVE_TAB_AGENT"; requestId: string }
  | { type: "EXTRACT_ACTIVE_PAGE"; requestId: string }
  | {
      type: "SELECTION_ACTION";
      requestId: string;
      action: SelectionAction;
      text: string;
      url: string;
      title: string;
    }
  | {
      type: "AI_CHAT_REQUEST";
      requestId: string;
      messages: AiMessage[];
      model: string;
    }
  | { type: "AI_STREAM_CHUNK"; requestId: string; delta: string }
  | { type: "AI_STREAM_DONE"; requestId: string }
  | { type: "AI_STREAM_ERROR"; requestId: string; message: string };
```

The final implementation may adjust fields, but it should keep message names explicit and request-scoped.

## Data Model

MVP storage uses `chrome.storage.local`.

```ts
type AiProvider = "openai";

type Settings = {
  provider: AiProvider;
  openaiApiKey?: string;
  modelPreset?: string;
  customModel?: string;
  defaultLanguage: "vi" | "en";
  updatedAt: string;
};

type StorageEnvelope<T> = {
  schemaVersion: number;
  data: T;
};

type PromptTemplate = {
  id: string;
  name: string;
  instruction: string;
  category:
    | "general"
    | "ceo"
    | "dev"
    | "legal"
    | "sales"
    | "marketing"
    | "custom";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type SavedResult = {
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
```

Storage defaults and lightweight migrations should be centralized in `src/lib/storage`. Storage should include a schema version key so future migrations can be explicit instead of inferred from missing fields. If prompt templates are missing, the app should seed the default templates once.

The OpenAI API key is stored locally for private MVP convenience, not as encrypted secret storage. The settings UI should say this plainly so the user understands the trade-off.

## Error Handling

The UI should give clear, actionable states for:

- Missing API key.
- Invalid or unavailable model.
- OpenAI authentication failure.
- OpenAI rate limit or quota failure.
- Network failure.
- Stream interruption.
- Current page extraction failure.
- Selection too short or too long.
- Storage read/write failure.

Errors should not expose the API key. The user should be able to retry failed AI calls when the source input is still available in memory.

## Testing Strategy

Automated tests should cover:

- Storage defaults and prompt seeding.
- Prompt template create, update, delete, and reorder behavior.
- Reader-mode extraction and fallback extraction using HTML fixtures.
- Prompt builders for page, selection, and chat flows.
- OpenAI streaming parser and error mapping.
- Message contract handling.
- Sidepanel component states: empty, missing key, streaming, error, saved results, and prompt management.
- Floating toolbar show/hide/action behavior at component or DOM utility level.

Manual Chrome verification should cover:

- Load unpacked extension.
- Save API key.
- Select preset model and custom model.
- Chat response streams correctly.
- `Read page` extracts and summarizes an article or documentation page.
- Selection toolbar appears and sends an action.
- Selection toolbar availability is verified after activating a tab through the extension.
- Prompt CRUD persists after extension reload.
- Saved result persists after extension reload.
- No AI request happens until the user explicitly triggers an action.

## Explicit Non-Goals

The MVP will not include:

- Claude or Gemini provider support.
- Backend proxy.
- User login.
- Team management.
- Role-based access control.
- Full chat history persistence.
- Usage analytics or logging.
- Chrome Web Store publishing.
- Deep Google Sheets or Google Docs API integration.
- Context menu actions unless the floating toolbar proves insufficient.

## Completion Criteria

The MVP is complete when the user can privately load the extension in Chrome and use it for daily reading, rewriting, summarizing, and analysis workflows.

The finished MVP must:

- Open a chat-first side panel.
- Store and use a personal OpenAI API key.
- Stream OpenAI responses.
- Read current page content only after the user clicks `Read page`.
- Process selected text through a floating toolbar.
- Make the floating toolbar available after explicit tab activation, without global `<all_urls>` host permission.
- Let the user fully manage prompt templates.
- Let the user save selected AI results.
- Avoid automatic page reading and background content sending.
- Keep the code structure ready for future provider expansion.
