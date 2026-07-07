# Sidebar Chat Foundation And UX Improvements

## Problem

The sidebar chat works and the current build is healthy, but the chat surface has accumulated too many responsibilities in `entrypoints/sidepanel/App.tsx`. The component currently owns view routing, settings loading, prompt and saved-result persistence, page reading, chat state, port streaming, error timers, selection prompt recovery, and message rendering.

This makes the chat harder to evolve safely. It also leaves several product gaps: chat requests do not include prior conversation context, page prompts are built inline instead of using the existing prompt builder, `GET_PENDING_SELECTION_PROMPT` is called by the sidebar without a matching background handler, and small usability affordances such as auto-scroll, clear chat, copy message, and saved-state feedback are missing.

The desired outcome is a stronger sidebar chat foundation plus a small set of high-value UX improvements, without introducing persisted conversation history or a full multi-session chat model.

## Scope

In scope:

- Move chat streaming and chat state out of `App.tsx` into a focused hook or controller.
- Send current in-memory conversation history with each AI chat request.
- Keep conversation history only for the current sidepanel lifetime.
- Limit the amount of history sent to the provider to avoid oversized requests.
- Use `buildPagePrompt(...)` for the read-page prompt path.
- Remove the dead `GET_PENDING_SELECTION_PROMPT` sidebar recovery path from `App.tsx`.
- Add small UX improvements: auto-scroll, clear chat, copy message, and saved-result feedback.
- Improve tests around chat streaming, history payloads, page prompts, clear/cancel behavior, copy, and save feedback.

Out of scope:

- Persisting conversations in `chrome.storage.local`.
- Multiple chat sessions, session switching, search, or archived history.
- Regenerate response, edit-and-resend, or branch conversations.
- Exporting full chats.
- Reworking the floating-window chat UI.
- Adding a background-side pending selection prompt store.
- Expanding markdown rendering beyond what message actions require.
- Changing provider settings, provider registry, API key storage, or background port protocol.

## Recommended Approach

Use a moderate refactor: extract sidebar chat behavior into a `useChatController`-style unit while leaving the existing UI structure and `AI_STREAM_PORT` protocol intact. This gives the sidebar clear boundaries without forcing a larger session model.

This approach is preferred because it fixes the current maintainability issue, enables conversation context, and supports small UX improvements with limited blast radius. It avoids the complexity of persistent sessions while still preparing the codebase for future chat features.

Alternatives considered:

- Minimal cleanup only: smallest change, but it would not address conversation context or the main `App.tsx` responsibility problem.
- Full session model now: cleaner for long-term product direction, but too large for the chosen scope because persisted conversations and multi-session UX are explicitly not needed yet.

## Architecture

`entrypoints/sidepanel/App.tsx`

- Remains the sidepanel shell.
- Loads settings, prompt templates, and saved results.
- Owns the current top-level view: chat, prompts, saved, settings.
- Delegates chat-specific state and actions to the chat controller.
- Keeps read-page entrypoint wiring, but delegates prompt construction to `buildPagePrompt(...)`.

Chat controller hook or module

- Owns `messages`, `streaming`, `streamingPhase`, and chat error state.
- Exposes `sendPrompt(text)`, `cancelStream()`, `clearChat()`, and any small action state needed by the chat UI.
- Opens and closes `AI_STREAM_PORT` for each request.
- Appends the user message and assistant placeholder before streaming starts.
- Updates the matching assistant message as chunks arrive.
- Handles done, error, and disconnect paths consistently.
- Keeps port refs and request IDs private to the controller.

Prompt builders

- Continue to own system prompt construction.
- Add or adapt a chat prompt builder that accepts previous chat messages plus the new user input and returns `AiMessage[]`.
- Exclude empty assistant placeholders and non-chat system/error display messages from provider payloads.
- Apply a simple history cap before sending to the provider.

Chat UI components

- `ChatComposer` keeps input, missing-key/model banner, and submit behavior.
- `ChatMessage` gains message-level actions needed for copy and save feedback.
- Chat list owns auto-scroll behavior through a ref or a small focused component.

Background streaming

- Keeps the existing `AI_CHAT_REQUEST` and `AiPortResponse` protocol.
- No background changes are required for normal streaming unless tests reveal a real mismatch.

## Data Flow

Normal prompt flow:

1. User submits text from `ChatComposer` or a quick chip.
2. `sendPrompt(text)` clears the current chat error and rejects the call if settings are not ready or a stream is already active.
3. The controller adds a user message and an empty assistant placeholder to sidebar state.
4. The controller builds provider messages from the current in-memory conversation history plus the new user text.
5. The controller connects to `AI_STREAM_PORT` and posts `AI_CHAT_REQUEST` with the generated `AiMessage[]`.
6. Background streams responses exactly as it does today.
7. The controller updates `streamingPhase` on connect and first-token messages.
8. Each chunk appends to the matching assistant message.
9. Done, error, or disconnect resets streaming state and releases the port reference.

Read-page flow:

1. User clicks `Đọc trang`.
2. `App.tsx` requests `EXTRACT_ACTIVE_PAGE` from the background.
3. If extraction succeeds, `App.tsx` builds the prompt with `buildPagePrompt({ title, url, text, warnings })`.
4. The resulting prompt is sent through the same `sendPrompt(...)` path as normal chat.

Selection prompt flow:

- The current automatic selection agent and floating-window flow remains unchanged.
- The sidebar no longer calls `GET_PENDING_SELECTION_PROMPT` because there is no background-side pending prompt store in scope.

## Conversation History Rules

- Conversation history is in-memory only.
- Reloading, closing, or reopening the sidepanel starts with an empty chat.
- The provider payload includes recent user and assistant messages from the current sidebar session.
- Empty assistant placeholders are not sent.
- Display-only system messages and UI errors are not sent.
- Use a simple technical cap to protect provider requests. The implementation should cap history by recent message count first, with a target such as the latest 12 non-empty chat messages before the new prompt. If this proves insufficient in implementation tests, add a simple character cap without introducing token counting.

## UX Behavior

Auto-scroll:

- The chat list scrolls to the newest content when messages are added or stream chunks arrive.
- The first implementation can always scroll to bottom. It does not need near-bottom detection.

Clear chat:

- Add a clear or new-chat control in the chat surface.
- Clearing resets messages and current chat error.
- If a response is streaming, clear first cancels the active stream and then clears messages.

Copy message:

- User and assistant messages expose a small copy action.
- Copy uses the browser clipboard API where available.
- On success, the UI shows short Vietnamese feedback such as `Đã sao chép`.
- On failure, the chat error path can show a concise Vietnamese error.

Save feedback:

- Assistant messages keep the existing save action.
- After save succeeds, the action shows a short `Đã lưu` state for that message.
- The saved result format remains `SavedResult` with `sourceType: "chat"`.

Streaming and errors:

- Cancel stream is exposed as `cancelStream()` instead of inline JSX logic.
- Missing API key/model behavior remains disabled composer plus Vietnamese setup banner.
- Runtime stream errors still show in the existing dismissible error area.
- Error text remains Vietnamese for user-facing UI.

## Components And Interfaces

`useChatController` or equivalent

- Inputs: current settings, resolved provider/model readiness, and callbacks for saving assistant results when the UI requests it.
- Outputs: `messages`, `streaming`, `streamingPhase`, `error`, `sendPrompt`, `cancelStream`, `clearChat`, and `dismissError`.
- Depends on: `chrome.runtime.connect`, `AI_STREAM_PORT`, `buildUserChatMessages` or its history-aware replacement.

History-aware prompt builder

- Input: previous chat items and new user text.
- Output: `AiMessage[]` containing the system prompt, capped recent conversation, and the new user message.
- Depends on: existing AI message types.

`ChatMessage`

- Inputs: role, content, optional save handler, optional copy handler, optional saved/copied status.
- Output: visual message bubble with actions.
- Does not know about storage, streaming ports, or prompt builders.

`App.tsx`

- Inputs: no new external inputs.
- Output: same sidepanel app behavior with cleaner orchestration.
- Depends on: storage functions, prompt manager, saved results, settings panel, chat controller.

## Error Handling

- Port connection failure sets `Không thể kết nối dịch vụ AI.` and returns the chat to idle.
- Stream error messages from background are shown through the controller error state.
- Disconnect with `chrome.runtime.lastError` shows the runtime error message or `Mất kết nối.`.
- Copy failure shows a concise Vietnamese error and does not alter message content.
- Save failure should not falsely show `Đã lưu`; the existing save function should surface failure through the chat error path if persistence rejects.
- Read-page extraction errors keep the current Vietnamese error behavior.

## Testing

Add or update tests for:

- Sidebar renders after settings load as it does today.
- Sending a second prompt includes recent user and assistant history in the `AI_CHAT_REQUEST` payload.
- Empty assistant placeholders are not included in provider payloads.
- Stream chunk, done, error, and disconnect update controller/UI state correctly.
- `clearChat()` cancels active stream and removes messages.
- `readPage()` sends a prompt generated by `buildPagePrompt(...)`.
- Removing `GET_PENDING_SELECTION_PROMPT` does not break sidebar mount behavior.
- Copy action calls `navigator.clipboard.writeText` and shows `Đã sao chép`.
- Save action persists a `SavedResult` and shows `Đã lưu` only after success.

Verification commands after implementation:

- `npm run compile`
- `npm test -- --run`

## Success Criteria

- `App.tsx` no longer owns low-level AI port streaming logic.
- Sidebar chat sends recent in-memory conversation context to the AI provider.
- Closing or reloading the sidepanel does not restore previous conversation messages.
- Read-page prompts use the shared page prompt builder.
- The dead pending-selection prompt call is removed from sidebar startup.
- Users can clear the current chat, copy message text, and see save feedback.
- Existing settings, prompt manager, saved results, and AI stream behavior continue to work.
- Typecheck and tests pass after implementation.
