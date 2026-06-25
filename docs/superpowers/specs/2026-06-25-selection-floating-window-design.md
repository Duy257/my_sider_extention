# Selection Floating Window

Replace side panel with a floating React window on the page for selection actions. Supports minimize, maximize, drag, and resize.

## Motivation

Current flow: select text → toolbar → click action → side panel opens on right. This forces the user to look away from their content. A floating window near the selection keeps focus on the page, reduces context switching, and provides a more integrated experience.

## Architecture

```
User selects text (20-20000 chars)
  → active-tab-agent.ts: showSelectionToolbar()
  → User clicks action
  → active-tab-agent.ts: sendSelectionAction() with position (x,y)
  → background.ts: receive SELECTION_ACTION
    → (no sidePanel.open())
    → forward FORWARD_SELECTION_ACTION to active-tab-agent
    → (pendingSelectionPrompts removed — content script already alive)
  → active-tab-agent.ts: receive FORWARD_SELECTION_ACTION
    → create container div at (x,y) with position:fixed, z-index:2147483646
    → mount React FloatingWindow via createRoot (shadow DOM)
    → open AI stream port → send prompt → stream response
  → FloatingWindow renders streaming result
```

### Key changes from existing code

- `background.ts`: Replace `chrome.sidePanel.open()` + forward to side panel → forward `FORWARD_SELECTION_ACTION` to active tab. Replace `chrome.sidePanel.setPanelBehavior(...)` with `chrome.action.onClicked` → inject content script. Remove `pendingSelectionPrompts` queue.
- `active-tab-agent.ts`: Add message listener for `FORWARD_SELECTION_ACTION`. Import and mount React floating window component.
- `entrypoints/sidepanel/`: Remove entire side panel entrypoint (no longer needed — floating window replaces it).
- Manifest permissions: No new permissions needed. `scripting` + `activeTab` already granted.

### Content script injection trigger

Currently the content script (`active-tab-agent.ts`) is injected when the side panel opens — `App.tsx` sends `ACTIVATE_ACTIVE_TAB_AGENT` on mount → `background.ts` calls `chrome.scripting.executeScript`. Without the side panel, a new trigger is needed.

**Solution:** Use `chrome.action.onClicked` as the injection trigger:
- Background registers `chrome.action.onClicked.addListener` → injects content script into the active tab
- This replaces `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`
- The extension icon now shows a visual indicator (e.g., badge text "ON") when the agent is active on the current tab
- `pendingSelectionPrompts` queue is removed — the content script is already alive when selection happens, so no recovery polling needed

### Streaming port ownership

Currently the AI streaming port is created inside sidepanel `App.tsx` (`sendPrompt()`). This responsibility moves to `active-tab-agent.ts` — it creates the port, sends `AI_CHAT_REQUEST`, receives `AI_STREAM_CHUNK`/`AI_STREAM_DONE`/`AI_STREAM_ERROR`, and passes chunks to the React floating window via a `StreamCallback` prop (`onChunk: (text: string) => void`).

## Component Tree

```
active-tab-agent.ts (vanilla JS → mount point)
└── <FloatingWindow>              — Shadow DOM container, state machine (default/min/max)
    ├── <WindowHeader>            — Drag handle, icon, title, [—] [□] [✕]
    ├── <WindowBody>
    │   ├── <ChatMessage />       — Reuse from sidepanel/components/ChatMessage.tsx
    │   └── <ChatComposer />      — Reuse from sidepanel/components/ChatComposer.tsx (only in maximized state)
```

### New components

**FloatingWindow.tsx** (injected via content script):
- State: `idle | loading | streaming | done | error`
- State machine for window: `default | minimized | maximized`
- Drag via mousedown on header → mousemove/mouseup
- Resize via handle at bottom-right corner → mousemove/mouseup
- Automatically clamp to viewport bounds
- Destroy + unmount on close (✕) or page scroll/resize (like toolbar)
- Position stored in closure for minimize/restore cycle

**WindowHeader.tsx**:
- Drag handle with cursor:move
- Title area (icon + "AI Assistant" or action name)
- Three controls: minimize [—], toggle-maximize [□], close [✕]
- Close dispatches destroy event

### Reused components

- `ChatMessage`: Renders AI response (streaming text, markdown). Same as sidepanel but without avatar/timestamp if compact.
- `ChatComposer`: Text input + send button. Only visible in maximized state. Same as sidepanel.

### Components NOT reused (removed from floating window scope)

- `HeaderBar` (extension-level nav, not needed in overlay)
- `SavedResults`, `PromptManager`, `SettingsPanel` (not needed in floating window — could be accessible via extension icon click)

## UI States

### Default (~380×500px)
- Positioned at toolbar location, clamped to viewport
- Top-left of window aligns with toolbar arrow tip
- Shows: header + streaming result
- No composer (user cannot type — just views the result)
- If result is done, shows the full response with markdown rendering

### Minimized (~40px bar, flush with right edge)
- Vertically centered in viewport
- Icon + tooltip: "AI — {action_name}"
- Click bar → restore to previous position and size
- Visual: subtle background, same accent color as theme

### Maximized (~90% viewport)
- Centered in viewport with margin
- Shows header + streaming result + ChatComposer
- User can type follow-up questions in Composer
- Click [□] again or Escape → back to default size

## Drag & Resize

- **Drag**: mousedown on WindowHeader (except control buttons). Track delta via mousemove on document. Update `top`/`left` in px. Release on mouseup.
- **Resize**: mousedown on 8px handle at bottom-right corner. Track delta to update `width`/`height`. Minimum 280×200px. Release on mouseup.
- Both use `position: fixed` coordinates.

## Error Handling

- **Stream error**: Show inline error in ChatMessage (reuse error rendering from sidepanel). User can close window or try again (maximized state has composer).
- **Content too long (>20000 chars)**: Keep existing `renderTooLongIndicator()` in toolbar. No change.
- **Selection cleared while window open**: Window stays open. User can close manually.
- **Page navigation**: Window is destroyed (content script context dies with page). No special handling.
- **Multiple selections**: Each action closes any existing window first, then opens a new one. Only one floating window at a time.

## Testing

- Unit test `FloatingWindow` state machine (default/min/max transitions)
- Unit test drag/resize logic (mouse event simulation)
- Integration test: mock `chrome.runtime.sendMessage` / `chrome.runtime.connect`, simulate `SELECTION_ACTION` → verify floating window renders with correct content
- Verify no side panel calls remain in background flow

## Files Changed

| File | Change |
|---|---|
| `entrypoints/background.ts` | Replace `chrome.sidePanel.open()` + forward to sidepanel → forward to active tab. Replace `chrome.sidePanel.setPanelBehavior()` with `chrome.action.onClicked` → inject content script. Remove `pendingSelectionPrompts`. |
| `entrypoints/active-tab-agent.ts` | Add `FORWARD_SELECTION_ACTION` listener; mount React; manage stream port |
| `entrypoints/sidepanel/App.tsx` | Remove `FORWARD_SELECTION_ACTION` listener; remove `GET_PENDING_SELECTION_PROMPT` |
| `entrypoints/sidepanel/` | Remove side panel entrypoint (no longer needed) |
| New: `src/lib/floating-window/FloatingWindow.tsx` | Floating React window component |
| New: `src/lib/floating-window/WindowHeader.tsx` | Header with drag + controls |
| New: `src/lib/floating-window/window.css` | Shadow DOM styles for floating window |
| `src/lib/selection/toolbar.ts` | Pass position coordinates in `onAction` callback |
| `wxt.config.ts` | Remove `sidePanel` permission (no longer needed). Change `action` from `default_title` to `onClicked` behavior. |

## Out of Scope

- No settings/preferences panel in floating window (use extension icon for that)
- No saved results view in floating window (only current result)
- No prompt manager in floating window
- No browser action popup (`default_popup` in manifest — extension icon now injects content script via `action.onClicked`)
