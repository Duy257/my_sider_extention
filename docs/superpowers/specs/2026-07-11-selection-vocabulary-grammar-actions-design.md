# Selection Vocabulary And Grammar Actions

## Problem

The selection toolbar currently supports general explanation, translation, rewriting, summarization, and action-list conversion. It does not provide dedicated learning actions for users who select English words, phrases, or sentences and want language-focused help.

Users need two explicit toolbar actions:

- Explain vocabulary in detail for language learning.
- Explain English grammar from the selected text.

These should feel like first-class selection actions, not a separate feature or a new UI flow.

## Goals

- Add two new toolbar buttons: `Giải thích từ vựng` and `Giải thích ngữ pháp`.
- Keep the existing five toolbar actions unchanged.
- Reuse the existing selection action pipeline and floating AI window.
- Make vocabulary explanations detailed enough for language learning.
- Make grammar explanations focus on English grammar and respond in Vietnamese.
- Keep the implementation localized to selection metadata, prompt building, tests, and docs.

## Non-Goals

- Do not replace or remove the existing `Giải thích` action.
- Do not add toolbar grouping, submenus, or user-configurable action ordering.
- Do not add a new floating window type or response renderer.
- Do not change provider settings, streaming, storage schema, or background message contracts beyond the existing action union accepting the new actions.
- Do not add dictionary APIs, pronunciation audio, or offline language databases.

## Recommended Approach

Add two new `SelectionAction` values and route them through the existing `SELECTION_ACTION` flow. The action-specific behavior belongs in `buildSelectionPrompt(...)`; the toolbar only needs labels and icons.

This is the smallest correct change because the current architecture already supports arbitrary selection actions through one typed action union, one action metadata list, and one prompt builder map. Background routing and the floating window do not need to know whether an action is a general explanation or a language-learning action.

Alternatives considered:

- Add a `Học ngôn ngữ` submenu. This keeps the toolbar narrower, but it adds content-script UI state, positioning, and click-outside complexity.
- Replace the existing `Giải thích` button with the two new actions. This keeps the toolbar at six buttons, but it conflicts with the requested behavior and removes a useful general explanation mode.

## User Experience

When the user selects text on a page, the toolbar appears as it does today for valid selections. The toolbar will contain seven icon-only buttons:

1. `Giải thích`
2. `Dịch sang tiếng Việt`
3. `Viết lại chuyên nghiệp`
4. `Tóm tắt`
5. `Bullet/Action list`
6. `Giải thích từ vựng`
7. `Giải thích ngữ pháp`

Each new button uses an inline SVG icon, `title`, and `aria-label`. Button text is not rendered inside the toolbar body, preserving the current compact icon-only design.

Clicking either new button opens the existing floating AI window near the selection and streams the AI response with the existing provider/runtime settings.

## Prompt Behavior

### Vocabulary Explanation

`Giải thích từ vựng` should behave like a detailed language-learning helper. The prompt should ask the AI to respond in Vietnamese and include:

- Meaning in Vietnamese based on the selected context.
- Part of speech.
- Pronunciation if the model can identify it confidently.
- Usage nuance, register, or connotation when relevant.
- Related phrases, collocations, or common pairings.
- Short example sentence.
- Common usage mistakes when useful.

The AI should not invent unsupported context. If the selected text is ambiguous, it should state what is uncertain.

### Grammar Explanation

`Giải thích ngữ pháp` should prioritize English grammar. The prompt should ask the AI to respond in Vietnamese and include:

- Sentence or phrase structure.
- Tense, clause, noun phrase, verb phrase, preposition, conjunction, or modifier analysis when present.
- The role of each important part.
- Common learner mistakes or confusing points.
- A simpler restatement when helpful.

If the selected text is not clearly English, the AI should say that English grammar analysis may not apply instead of pretending the text is English.

## Architecture

`src/lib/selection/types.ts`

- Add `explain_vocabulary` to `SelectionAction`.
- Add `explain_grammar` to `SelectionAction`.

`src/lib/selection/actions.ts`

- Add two entries to `SELECTION_ACTIONS`.
- Labels are `Giải thích từ vựng` and `Giải thích ngữ pháp`.
- Icons are inline SVG strings using `currentColor`, `aria-hidden="true"`, and `focusable="false"`.
- Keep the existing five actions in their current order, then append the two new learning actions.

`src/lib/prompts/builders.ts`

- Add `SELECTION_INSTRUCTIONS.explain_vocabulary`.
- Add `SELECTION_INSTRUCTIONS.explain_grammar`.
- Keep the shared selection system message unchanged.
- Keep `buildSelectionPrompt(action, text)` unchanged except that the instruction map handles the new actions.

`entrypoints/active-tab-agent.ts`

- No behavior change expected. It already accepts any `SelectionAction`, builds the prompt, sends `SELECTION_ACTION`, removes the toolbar, and clears the selection.

`entrypoints/background.ts`

- No behavior change expected. It forwards the prompt and position to the active tab's floating window.

`src/lib/floating-window/`

- No change expected. It streams and renders markdown output independently of the action type.

## Data Flow

1. User selects 3-20,000 trimmed characters.
2. `active-tab-agent.ts` renders the selection toolbar.
3. User clicks `Giải thích từ vựng` or `Giải thích ngữ pháp`.
4. The content script calls `buildSelectionPrompt(action, text)` with the new action value.
5. The content script sends the existing `SELECTION_ACTION` message.
6. Background forwards `FORWARD_SELECTION_ACTION` back to the tab with the generated prompt and selection position.
7. The floating window opens and streams the AI response.

## Error Handling

- Empty or whitespace-only selections still show no toolbar.
- Selections shorter than 3 characters still show no toolbar.
- Selections longer than 20,000 characters still show the existing Vietnamese too-long indicator.
- Ambiguous vocabulary selections should receive an uncertainty note from the AI prompt rather than fabricated certainty.
- Non-English text selected for grammar explanation should receive a clear limitation note from the AI prompt.
- Provider/API/runtime errors continue through the existing floating window error path.

## Testing

Update `tests/selection/toolbar.test.ts`:

- Expect seven toolbar buttons instead of five.
- Extend the expected label list with `Giải thích từ vựng` and `Giải thích ngữ pháp`.
- Assert both new buttons keep `title`, `aria-label`, and inline `svg` output.
- Extend click-callback coverage so the new action values can be emitted.
- Keep existing selection length and too-long indicator tests unchanged.

Update `tests/prompts/builders.test.ts`:

- Add a test for `buildSelectionPrompt("explain_vocabulary", ...)` verifying vocabulary-learning instructions are present in Vietnamese.
- Add a test for `buildSelectionPrompt("explain_grammar", ...)` verifying English grammar analysis instructions are present in Vietnamese.
- Keep existing general selection prompt tests unchanged.

## Documentation

Update `docs/modules/selection.md` after implementation:

- Document the full seven-action `SelectionAction` union.
- Document that the toolbar has seven icon-only actions.
- Mention the two new language-learning actions and their intended focus.

## Success Criteria

- Toolbar still appears for valid selections and keeps the current lifecycle.
- Toolbar displays seven icon-only buttons.
- Existing five actions keep their current behavior.
- `Giải thích từ vựng` opens the floating AI window and produces a detailed vocabulary-learning prompt.
- `Giải thích ngữ pháp` opens the floating AI window and produces an English grammar-focused prompt.
- Background routing and floating-window streaming remain unchanged.
- Updated unit tests pass.
