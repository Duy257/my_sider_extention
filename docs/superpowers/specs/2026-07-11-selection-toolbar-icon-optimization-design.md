# Selection Toolbar Icon Optimization

## Problem

The current text-selection toolbar is too restrictive and visually heavier than needed. It only appears for selections with at least 20 characters, so short words, terms, abbreviations, and small phrases cannot be sent to AI from the page. The toolbar also renders text labels and emoji icons, making it wider and less consistent with a polished extension UI.

## Goals

- Allow short but intentional selections to use AI actions.
- Keep empty or accidental tiny selections from showing noisy UI.
- Make the toolbar compact by rendering icon-only buttons.
- Replace emoji with inline SVG icons so the UI can be styled consistently.
- Preserve the current five selection actions and the existing AI routing flow.

## Scope

In scope:

- Change the minimum allowed selection length from 20 characters to 3 characters.
- Keep the maximum allowed selection length at 20,000 characters.
- Render the selection toolbar with five icon-only action buttons.
- Replace emoji action icons with inline SVG icons.
- Keep Vietnamese `title` and `aria-label` text for each action button.
- Update tests and selection module documentation to match the new behavior.

Out of scope:

- Adding user settings for the selection length threshold.
- Adding user settings to show, hide, or reorder actions.
- Changing selection prompts, prompt builders, or AI model behavior.
- Changing the background message contract, floating window, or streaming flow.
- Changing HTTPS auto-injection behavior.

## Recommended Approach

Use the smallest change that fixes the current usability issue: keep the existing toolbar lifecycle and action flow, but lower the minimum threshold and make the toolbar render icon-only SVG buttons.

This is preferred because it avoids touching the more sensitive parts of the extension: content-script injection, background routing, floating window mounting, and AI streaming. The change stays localized to `src/lib/selection/` plus tests and docs.

Alternatives considered:

- Show a disabled toolbar or warning for 1-2 character selections. This explains why an action is unavailable, but it adds UI noise for accidental selections.
- Expand labels on hover. This is more expressive, but it adds layout complexity and increases the risk that the toolbar shifts or covers content.

## Behavior

Selection validation:

- Empty or whitespace-only selection: no toolbar.
- Selection with 1-2 trimmed characters: no toolbar.
- Selection with 3-20,000 trimmed characters: show the toolbar and allow all five actions.
- Selection above 20,000 trimmed characters: show the existing too-long indicator.

The existing action set remains unchanged:

- Giải thích
- Dịch sang tiếng Việt
- Viết lại chuyên nghiệp
- Tóm tắt
- Bullet/Action list

## UI Design

The toolbar remains a floating pill near the selected text. Each action button becomes compact and icon-only. Text labels are not rendered inside the button body, but each button keeps a Vietnamese `title` and `aria-label` so users can understand the action on hover and assistive technologies can announce it.

SVG icon requirements:

- Icons are inline SVG, not emoji.
- Icons use `currentColor` so hover/focus styling can be controlled through button color.
- Icons are decorative inside the button body and paired with `aria-label` on the button.
- No external icon package or asset file is required.

The toolbar keeps the current dark surface, hover state, divider styling, high z-index, entrance animation, and fixed positioning. Each icon button should use a compact square hit area of roughly 32x32px so five actions fit comfortably without labels.

## Architecture

`src/lib/selection/actions.ts`

- Keep the `SelectionAction` values and Vietnamese labels.
- Replace emoji metadata with an `iconSvg` string containing inline SVG markup.

`src/lib/selection/types.ts`

- Keep the current `SelectionAction` union unchanged.
- No message contract changes are needed.

`src/lib/selection/toolbar.ts`

- Change `MIN_SELECTION_CHARS` from `20` to `3`.
- Keep `MAX_SELECTION_CHARS` at `20000`.
- Render each action button with inline SVG only.
- Add `aria-label` while keeping the existing `title`.
- Keep `renderTooLongIndicator(...)` behavior unchanged.

`entrypoints/active-tab-agent.ts`

- Continue using `isSelectionLengthAllowed(...)`, `isSelectionTooLong(...)`, and `renderSelectionToolbar(...)`.
- No direct behavior change is expected here unless type signatures require a call-site adjustment.

`entrypoints/background.ts` and `src/lib/floating-window/`

- No changes. Selection actions still send the same message and open the same floating window flow.

## Data Flow

1. User selects text on an HTTPS page.
2. `active-tab-agent.ts` debounces `selectionchange` and reads the trimmed selection text.
3. If the text is empty or shorter than 3 characters, no UI appears.
4. If the text is longer than 20,000 characters, the too-long indicator appears.
5. If the text is valid, `renderSelectionToolbar(...)` renders five icon-only SVG buttons.
6. User clicks an action button.
7. The content script sends the existing `SELECTION_ACTION` message with the same action, text, URL, title, prompt, and position data.
8. Background forwards the action to the tab and the existing floating window streams the AI response.

## Error Handling

- Too-short selections silently do nothing, matching the current no-toolbar behavior for invalid short selections.
- Too-long selections keep the existing Vietnamese indicator.
- If SVG rendering metadata is malformed during development, tests should catch missing SVG output.
- AI/settings/background errors remain handled by the existing floating window and streaming error paths.

## Testing

Update `tests/selection/toolbar.test.ts`:

- Assert that 2-character selections are rejected.
- Assert that 3-character selections are accepted.
- Keep assertions that 20,000 characters are accepted and 20,001 are rejected.
- Assert that the toolbar still renders five buttons.
- Stop expecting action labels in `toolbar.textContent`.
- Assert each button has the expected Vietnamese `title` and `aria-label`.
- Assert each button contains an `svg` icon.
- Keep the click callback test for action ordering.
- Keep the too-long indicator tests unchanged because the too-long behavior and text do not change.

No background tests are required because the selection action message contract does not change.

## Documentation

Update `docs/modules/selection.md` after implementation so it documents:

- The new valid selection range: 3-20,000 characters.
- Icon-only toolbar rendering.
- Inline SVG icons instead of emoji.

## Success Criteria

- Selecting 1-2 non-whitespace characters does not show the toolbar.
- Selecting 3 or more non-whitespace characters shows the toolbar, up to the 20,000-character maximum.
- The toolbar displays five compact icon-only buttons.
- No emoji are rendered in toolbar buttons.
- Each button remains understandable via `title` and `aria-label`.
- Existing selection actions still open the floating AI window and stream responses.
- Updated tests pass.
