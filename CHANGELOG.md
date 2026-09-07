# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-09-07

### Added
- **Rich Content Message Parser & Renderer**:
  - Unified message parser pipeline in `src/core/message-parser/` providing structured block detection and typed tokenization.
  - **TableBlock**: Responsive markdown table renderer with interactive column sorting (ascending/descending) and Vietnamese locale-aware numerical sorting.
  - **AlertBlock**: Styled callout boxes for alerts, tips, warnings, errors, and notes (supporting both emoji prefixes `⚠️`, `💡`, `❗`, `✅`, `📌` and GitHub alert syntax `[!NOTE]`, `[!TIP]`, etc.).
  - **JsonBlock**: Collapsible formatted JSON tree rendering with copy-to-clipboard button.
  - **CodeBlock**: Monospace code panel with language header badge, copy button with confirmation feedback, and scroll containment (`max-h-96 overflow-auto`).
  - **Semantic Headings**: Full `h1..h6` semantic tag support with distinct typography, margins, and border styles.
  - **Inline Formatter**: Single-pass tokenizer handling complex inline markdown combinations (`***bold-italic***`, `**bold**`, `*italic*`, `` `inline code` ``, links, and escaped `\*`).
  - **QuoteBlock & ListBlock**: Styled blockquotes and ordered/unordered lists.
- **Floating Window Architecture & Custom Hooks**:
  - `useDraggable`: Hook for window dragging with explicit event listener cleanup and viewport boundary clamping.
  - `useResizable`: Hook for bottom-right corner resizing with automatic cursor and user-select restoration.
  - Automatic viewport re-clamping on browser window `resize` events.
  - Responsive full-screen maximization for mobile and narrow viewports (<= 480px).
  - Dynamic status title in `WindowHeader` ("AI đang kết nối...", "AI đang trả lời...", "Lỗi phản hồi", "AI Assistant").
  - Empty response fallback banner when an AI stream completes without text output.
  - Isolated Shadow DOM styling in `floating-mount.ts` supporting all rich content utility classes.
- **DevTools Accessibility & Usability**:
  - ARIA attributes (`role="region"`, `aria-label`, `aria-live="polite"`, `aria-expanded`, `aria-controls`) across `DebugDetails` and `ToolTraceCard`.
  - Vietnamese localized metadata labels (`Trình trích xuất`, `Số ký tự`, `Độ dài văn bản`, `Cảnh báo`, `Hành động`, etc.) in `DEV_COPY`.
  - Pretty-printed JSON display with scrolling for `effectiveRequestParams`.
  - Comprehensive unit test suites: `tests/message-parser.test.tsx`, `tests/components/floating-chat-message.test.tsx`, and expanded test cases in `tests/floating-window.test.tsx`, `tests/devtools/tool-trace-card.test.tsx`, `tests/devtools/debug-details.test.tsx`.

### Changed
- Refactored `MessageContent` (Sidepanel) to use the shared `parseMessageBlocks` parser cached with `useMemo`.
- Refactored `FloatingChatMessage` (Floating Window) to share the common parser, eliminating duplicated markdown parsing logic.
- Decoupled streaming cursor from the message block tree, rendering it in an outer container.
- Cleaned up control buttons in `WindowHeader` using CSS pseudo-classes instead of stateful hover handlers.

### Fixed
- **[F1]**: Fixed memory leaks and stuck document mouse cursor/selection freeze caused by dangling `mousemove`/`mouseup` listeners when the floating window was unmounted during drag or resize.
- **[F6]**: Decoupled stream connection lifecycle from `toolTrace` reference changes, preventing accidental stream aborts.
- **[F9]**: Preserved and restored previous window position and size (`lastDefaultStateRef`) when minimizing, maximizing, or pressing Escape, instead of resetting to initial mount defaults.
- **[D1]**: Fixed unmounted component state updates and copy race conditions in `DebugDetails` by tracking active timer refs and clearing timeouts on unmount.
- **[D4]**: Prevented reasoning stream updates from forcibly reopening the `DebugDetails` panel after the user has manually collapsed it.
- **[T1]**: Replaced unsafe type assertion `as [string, Scalar][]` in `ToolTraceCard` with a runtime type guard (`isScalar`).

## [0.3.2] - 2026-09-07

### Fixed
- Fixed `Request is missing x-opencode-session and cannot be routed efficiently` error when using OpenCode provider (Console Go router).
- Added automatic `x-opencode-session` header injection for all requests to OpenCode gateway (`opencode.ai`), including streaming chat completion, non-streaming completion, test connection, and model loading.

### Added
- Session lifecycle management (`sessionId`) across UI components: Sidepanel Chat (`useChatController`), Floating Selection Window (`FloatingWindow`), Reading Companion QA (`QATab`), Summary (`SummaryTab`), and Definition Popover (`DefinitionPopover`) to ensure backend routing affinity and enable prompt caching.
- Runtime provider header resolver function (`getProviderHeaders`) for provider-specific headers.
- Unit tests covering `x-opencode-session` header transmission, HTTP client safety net, and `sessionId` persistence across conversation turns and reset on "Chat mới" (New Chat).

## [0.3.1] - 2026-07-12

### Removed
- Removed the sidebar page reading feature ("Đọc trang") including the button on `HeaderBar`, `readPage` logic, and `readingPage` state in `App.tsx` to streamline the UI.

### Changed
- Redesigned and relocated the "Chat mới" (New Chat) button from the message area to the sticky `HeaderBar` so that it is always accessible even during long conversations.
- Overhauled the "Gợi ý nhanh" (Quick Prompts) in `EmptyState` with 5 highly useful scenarios (Concept Explanation, Natural Translation, Style Polish, Info Summarization, Code Optimization) featuring a premium card-style design with descriptive subtext.

## [0.3.0] - 2026-07-11

### Added
- Two new selection toolbar actions: "Giải thích từ vựng" (Vocabulary Explanation) and "Giải thích ngữ pháp" (Grammar Explanation) to support detailed language learning workflows.
- Bilingual prompts in Vietnamese with detailed instructions and safety guardrails for vocabulary and English grammar analysis.
- Expanded selection toolbar to support 7 compact icon-only buttons.

### Fixed
- Centered selection toolbar by updating horizontal positioning offset to 152px to match the wider 7-button layout.
- Implemented right-edge screen boundary check to prevent the toolbar from overflowing the window width.
- Resolved toolbar button click issues where clicking a button caused the selection to clear before triggering the action; fixed by invoking `event.preventDefault()` and `event.stopPropagation()` on `mousedown`, and adding `pointer-events: none` to button SVG icons.

## [0.2.0] - 2026-07-10

### Added
- Developer Mode toggle under Settings Panel.
- Comprehensive AI Dev Traces tracking first token latency (TTFT), execution duration, input/output/total token counts, requested thinking mode effort parameters, and raw AI reasoning output (with copy function).
- Tool Dev Traces tracking background operations for page extraction (`read-page`), text selection (`selection-action`), and reading companion loading (`open-reader`).
- Ephemeral long-running runtime Port-based debug stream pipeline (`AI_STREAM_DEBUG_START`, `AI_STREAM_REASONING`, `AI_STREAM_DEBUG_UPDATE`).
- Throttled UI updates (100ms batching interval) inside `useChatController` to prevent rendering lag during high-frequency reasoning streams.
- Visual tool trace cards and loading indicators in Sidepanel timeline, Floating Selection Window, and Reading Companion.
- Reading Companion watchdog handoff timeout (10 seconds) with explicit `LOAD_READER_ERROR` messaging and proper listener cleanup.
- Storage schema upgraded to v5 preserving existing settings configurations.

## [0.1.0] - 2026-07-10

### Added

- AI chat with streaming in sidebar
- Page reading & summarization (Readability.js)
- Text selection toolbar with floating actions
- Multi-provider support: OpenAI, OpenCode, CommandCode, LMStudio
- Prompt management (create, edit, organize)
- Chat history with saved results
- Thinking mode toggle per chat
- BYOK (Bring Your Own API Key) model
