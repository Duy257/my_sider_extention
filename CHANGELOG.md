# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
