# AI Reading Companion

## Problem

Users currently have two ways to interact with page content: "Đọc trang" (extracts + summarizes into side panel) and text selection toolbar (inline actions on selected text). Neither provides a dedicated, distraction-free reading experience with AI assistance. Users who want to deeply read an article while asking questions, getting inline definitions, or generating section-level summaries must switch between the page and the side panel manually.

The extraction infrastructure (Readability.js + DOM fallback) already exists, as does the streaming AI port. What is missing is a cohesive reading surface that brings these together in one focused view.

## Scope

In scope:

- New `entrypoints/reader/` with a two-column layout: reading view (70%) + AI companion panel (30%).
- Reading view renders extracted article content with clean typography, images, code blocks.
- AI companion with three tabs: **Summary**, **Q&A**, **Inline Definition**.
- Inline definition popover on text selection within reading view.
- Three entry points: extension popup, side panel button, right-click context menu.
- Manual save of reading session (summary + highlights + notes) to Saved Results.
- Communication: background extracts page content → passes to reader tab via messaging.

Out of scope:

- Multiple reading sessions in parallel (one at a time).
- Persistent reading history or reading list.
- Page annotation/highlight persistence (highlights exist only within session).
- Voice input for Q&A.
- Offline reading.
- Changing extraction logic, provider settings, API key storage, or port protocol.

## Recommended Approach

All-in-One Reader Tab (Approach 1 from brainstorming). A new WXT entrypoint (`entrypoints/reader/`) opens as a browser tab containing both the reading view and the AI companion. This gives a single-window experience where the user reads and queries without switching contexts.

Alternatives considered:

- **Reader tab + side panel combo**: simpler but forces split attention between tab and side panel. No inline definition support.
- **In-page overlay (Medium-style)**: more complex DOM manipulation, risk of breaking page layout, harder to style consistently.

## Architecture

### Entrypoints

`entrypoints/reader/`

```
entrypoints/reader/
├── main.tsx            — React entry point
├── App.tsx            — Root: layout orchestration
├── styles.css         — Tailwind imports + reader-specific styles
└── components/
    ├── ReaderView.tsx       — Article content rendering (70%)
    ├── ReaderHeader.tsx     — Back, title, save button
    ├── CompanionPanel.tsx   — AI companion container (30%)
    ├── SummaryTab.tsx       — Page/section summary
    ├── QATab.tsx            — Q&A chat interface
    ├── DefinitionPopover.tsx— Inline definition popover
    └── ProgressBar.tsx      — Reading progress indicator
```

### Background changes

Add new message type `OPEN_READING_COMPANION` to `src/lib/messaging/types.ts`:

Handler flow in `background.ts`:

1. Receive `OPEN_READING_COMPANION` with the current tab ID.
2. Check if `active-tab-agent.js` is injectable; inject if needed.
3. Send `EXTRACT_PAGE_CONTENT` to the tab (reuse existing extraction).
4. On success, create reader tab via `chrome.tabs.create({ url: browser.runtime.getURL("/reader.html") })`.
5. Wait for reader tab to signal readiness via a connect message.
6. Forward extracted content `{ title, url, content, excerpt }` to reader tab.

### New message types

```typescript
// messaging/types.ts additions
OPEN_READING_COMPANION       // background: open reader tab with extracted content
READER_CONTENT_READY         // reader → background: signal tab ready
LOAD_READER_CONTENT          // background → reader: send extracted data
READER_SAVE_SESSION          // reader → background: save session to storage
READER_DEFINITION_REQUEST    // reader → background: request inline definition
```

### Reused infrastructure

- `src/lib/extraction/` — unchanged, handles Readability + DOM fallback.
- `src/lib/ai/client.ts` — AI streaming for Q&A and summaries.
- `src/lib/ai/runtime.ts` — provider config resolution.
- `src/lib/messaging/ports.ts` — `AI_STREAM_PORT` for streaming Q&A.
- `src/lib/storage/` — save sessions as `SavedResult` entries.
- Tailwind theme from `tailwind.config.ts` — same warm dark palette.

## Data Flow

### Open reader flow

1. User activates reading companion (popup/side panel/context menu).
2. Background receives `OPEN_READING_COMPANION`.
3. Background injects content script → extracts page via Readability/DOM.
4. Background creates reader tab → waits for `READER_CONTENT_READY`.
5. Background sends `LOAD_READER_CONTENT` with `{ title, url, content, excerpt }`.
6. Reader tab renders article in ReaderView, injects content into CompanionPanel context.

### Summary flow

1. User clicks Summary tab → sees options: "Tóm tắt toàn trang" / "Tóm tắt section".
2. CompanionPanel sends request via `AI_STREAM_PORT` with system prompt + page content.
3. Response streams into SummaryTab display area.
4. Summary cached in session memory; switching tabs does not re-request.

### Q&A flow

1. User types question in QATab input.
2. CompanionPanel builds prompt: `{ system: page context, user: question }`.
3. Sends via `AI_STREAM_PORT` — streaming response renders in chat list.
4. Each Q&A pair kept in Q&A session history (in-memory, lost when tab closes).

### Inline definition flow

1. User selects text in ReaderView.
2. DefinitionPopover appears near selection with debounce 300ms.
3. Sends `READER_DEFINITION_REQUEST` to background → AI returns short explanation.
4. Cache definition in session memory per highlighted phrase.
5. If user clicks "Hỏi thêm", pre-fill QATab input with selected text.

### Save session flow

1. User clicks "Lưu session" button in ReaderHeader.
2. Reader tab collects: page summary, any highlights/notes, page metadata.
3. Sends `READER_SAVE_SESSION` to background.
4. Background persists as `{ sourceType: "reader", title, summary, url, date }` in saved results.
5. Reader tab shows "Đã lưu" feedback.

## UX Behavior

### Reader view

- Article content rendered with Plus Jakarta Sans, 16px body, 1.7 line-height.
- Images preserved with max-width 100%, rounded corners.
- Code blocks with syntax label and copy button.
- Blockquotes styled with left border + italic.
- Headings H1–H3 with proper hierarchy spacing.
- Max text width ~700px for comfortable reading.
- Scrolling progress bar pinned to top of page.

### AI Companion Panel

- Fixed right panel, 30% width, scrollable independently.
- Three tabs: **Tóm tắt** | **Hỏi đáp** | **Định nghĩa**.
- Active tab indicator (violet underline).
- Panel collapses to bottom sheet on narrow screens (<900px).

### Summary tab

- Radio/chip selector: "1 câu" | "1 đoạn" | "Chi tiết".
- Section list generated from H1-H2 headings in article.
- Click section → generate section-specific summary.
- "Key takeaways" button → 3-5 bullet points.

### Q&A tab

- Chat message list (scrollable) with user/AI bubbles (reuse ChatMessage styling).
- Input field at bottom with send button.
- Preset question chips above input.
- Streaming typing indicator during response.

### Inline definition

- Text selection triggers popover after 300ms debounce.
- Popover positioned above/below selection; arrow pointing to selection.
- Shows AI explanation (1-3 sentences).
- "Hỏi thêm" link → focuses Q&A tab with pre-filled question.
- Click outside or Escape dismisses popover.

### Entry points

| Entry Point | Implementation | Notes |
|---|---|---|
| **Context menu** | `chrome.contextMenus.create({ id, title, contexts: ["page"] })` in background.ts on install | Title: "Đọc với AI" |
| **Side panel** | New button in HeaderBar next to "Đọc trang" | Icon: book-open icon |
| **Extension popup** | New `entrypoints/popup/` — minimal HTML, no React | Single button: "Đọc với AI" |

## Components and Interfaces

### `ReaderView`

- Inputs: `content: ExtractedContent` (title, body HTML, url, excerpt, headings)
- Outputs: rendered article, selection events for DefinitionPopover
- Depends on: reader-specific CSS, shared MessageContent for inline rendering

### `CompanionPanel`

- Inputs: `pageContext: ExtractedContent`
- Owns state: active tab, summary result, Q&A messages, definition cache
- Outputs: tab switch events, save signal
- Depends on: `useChatController`-style hook for Q&A, AI port for summary/definition

### `DefinitionPopover`

- Inputs: `selectionRect, selectedText`
- Outputs: definition content from AI, "Hỏi thêm" action
- Depends on: AI fetch (non-stream, short response), session cache

### Background handler changes

- New handler for `OPEN_READING_COMPANION` in background.ts
- New handler for `READER_SAVE_SESSION` → calls `saveResult()` from storage
- New handler for `READER_DEFINITION_REQUEST` → calls non-stream AI fetch

## Storage

### Save session format

```typescript
interface ReaderSavedSession {
  sourceType: "reader";
  title: string;
  url: string;
  summary: string;        // latest generated summary
  date: string;           // ISO date
  // Stored as SavedResult — compatible with existing saved results view
}
```

Saved sessions appear in the existing Saved Results list (source type differentiates from chat-saved results visually with a book icon).

No new storage schema version needed — SavedResult type already exists.

## Error Handling

| Scenario | Behavior |
|---|---|
| Page extraction fails | Warning in companion: "Không thể đọc nội dung trang này." |
| Content truncated (>40k) | Warning banner in reader view: "Nội dung đã bị cắt bớt." |
| AI stream fails (Q&A) | Error message in Q&A: "Không thể kết nối AI. Thử lại sau." |
| Definition request fails | Popover shows: "Không thể lấy định nghĩa." |
| Save fails | Feedback: "Lưu thất bại." instead of "Đã lưu" |
| Reader tab closed before content arrives | Background cleanup — no orphan state |
| Provider not configured | Open reader tab → show missing-key banner in companion panel |

## Testing

Add or update tests for:

- Reader component renders extracted article content.
- Companion panel switches between Summary, Q&A, and Definition tabs.
- Q&A tab sends chat via port and displays streaming response.
- Summary request generates correct AI prompt with page context.
- Inline definition popover appears on selection and shows AI response.
- Save session persists to storage and shows feedback.
- Background handler extracts page and creates reader tab.
- Context menu item created on install.
- Narrow screen collapses companion to bottom sheet.

Verification commands after implementation:

- `npm run compile`
- `npm test -- --run`

## Success Criteria

- User can open any article in a clean reading view with one click.
- User can ask questions about the article and get contextual AI answers.
- User can get inline definitions of terms by selecting text.
- User can get summaries at page level or section level in three verbosity levels.
- Three entry points function correctly (popup, side panel, context menu).
- User can save reading sessions and find them in Saved Results.
- Existing extraction, AI streaming, and storage continue to work.
- Typecheck and tests pass after implementation.
