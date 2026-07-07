# HTTPS Auto Selection Agent

## Problem

Selection tools currently depend on the side panel activation path. `entrypoints/sidepanel/App.tsx` sends `ACTIVATE_ACTIVE_TAB_AGENT` when the side panel mounts, then `entrypoints/background.ts` injects `active-tab-agent.js` into the active tab. If the user has not opened the side panel, `entrypoints/active-tab-agent.ts` is not running, so it cannot listen for `selectionchange` or render the selection toolbar.

The desired behavior is: on supported pages, the extension should show the selection toolbar without requiring the side panel to be opened first.

## Scope

In scope:

- Auto-run the selection/page agent on HTTPS pages.
- Keep the existing side panel behavior when the user clicks the extension icon.
- Keep the existing toolbar, selection length limits, floating window, and AI streaming flow.
- Remove or suppress the activation toast so it does not appear on every HTTPS page load.

Out of scope:

- Auto-run on HTTP, localhost, or `file://` pages.
- Replacing the side panel.
- Changing provider settings, prompt templates, saved results, or AI model behavior.
- Adding a new UI preference for enabling/disabling the auto-run behavior.

## Recommended Approach

Register the active tab agent as a normal WXT content script matching `https://*/*`. The implementation can do this by renaming/adding the WXT content-script entrypoint or by using the equivalent WXT manifest configuration. The required output is that the built manifest lists the agent as a HTTPS content script.

This is preferred over background-driven tab injection because it directly matches the product goal: the toolbar should be available before the user opens the side panel or clicks the extension icon. It also avoids extra lifecycle logic in the background service worker.

Alternatives considered:

- Background auto-inject on tab updates: more complex and easier to miss edge cases.
- Manual icon activation: smallest change, but it does not satisfy the requirement because the user still has to activate the extension before selecting text.

## Architecture

New flow:

1. User opens a HTTPS page.
2. Browser automatically injects `active-tab-agent.ts` as a content script.
3. `active-tab-agent.ts` checks `window.__personalAiSidebarAgentInstalled` and exits if it has already been installed on that page.
4. The script registers selection listeners.
5. User selects text.
6. If the selected text length is valid, `renderSelectionToolbar(...)` renders the menu near the selection.
7. User clicks a toolbar action.
8. `active-tab-agent.ts` sends `SELECTION_ACTION` to `background.ts`.
9. `background.ts` forwards `FORWARD_SELECTION_ACTION` back to the sender tab.
10. `active-tab-agent.ts` mounts the floating window.
11. The floating window opens `AI_STREAM_PORT` and streams the AI response.

The side panel remains available. Clicking the extension icon should continue to open the side panel as it does today.

## Components

`entrypoints/active-tab-agent.ts`

- Becomes the always-available selection agent on HTTPS pages.
- Keeps selection detection, toolbar display, page extraction, and floating window mounting.
- Keeps the duplicate-install guard via `window.__personalAiSidebarAgentInstalled`.
- Removes or disables the activation toast for automatic page-load execution.

`src/lib/selection/toolbar.ts`

- No behavior change planned.
- Continues to enforce minimum 20 characters and maximum 20,000 characters.

`entrypoints/background.ts`

- Keeps AI streaming and message routing.
- Keeps `ACTIVATE_ACTIVE_TAB_AGENT` only as compatibility for existing callers, not as the primary toolbar activation path.
- Keeps forwarding `SELECTION_ACTION` to the sender tab via `FORWARD_SELECTION_ACTION`.

`entrypoints/sidepanel/App.tsx`

- Keeps existing sidebar UI and settings/chat flow.
- May keep the current activation sendMessage for compatibility, but it should no longer be required for the toolbar on HTTPS pages.

WXT content-script registration

- Configures the extension so the active tab agent is registered for HTTPS pages in the built manifest.
- Keeps the side panel manifest behavior unchanged.
- Keeps permissions minimal for the chosen scope.

## Error Handling

- Non-HTTPS pages do not auto-run the selection toolbar. This is expected.
- Restricted browser pages may still reject content scripts. These failures should not show noisy page UI.
- If `FORWARD_SELECTION_ACTION` fails, the page should not crash. The existing toolbar can disappear and the error can remain a background/content-script log.
- If API settings are invalid, the floating window should show the existing AI stream error state.
- If selected text is too short, no toolbar appears.
- If selected text is too long, the existing too-long indicator appears.

## Testing

- Verify build output or manifest registration includes the HTTPS content script match for the active tab agent.
- Verify the side panel still opens from the extension icon.
- Verify selecting 20-20,000 characters on a HTTPS page shows the toolbar without opening the side panel.
- Verify selecting fewer than 20 characters does not show the toolbar.
- Verify selecting more than 20,000 characters shows the too-long indicator.
- Verify the content script duplicate guard prevents double listener setup if the compatibility injection path still runs.
- Run `npm run compile` and `npm test` after implementation.

## Success Criteria

- On HTTPS pages, selecting valid text shows the toolbar even if the side panel has never been opened.
- Clicking a toolbar action opens the floating AI window and streams the response.
- Clicking the extension icon still opens the side panel.
- No activation toast appears automatically on every HTTPS page load.
- HTTP, localhost, and file pages are not included in the auto-run behavior.
