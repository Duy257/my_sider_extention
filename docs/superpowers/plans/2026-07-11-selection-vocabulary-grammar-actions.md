# Selection Vocabulary And Grammar Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new selection toolbar actions, `Giải thích từ vựng` and `Giải thích ngữ pháp`, that reuse the existing floating AI response flow.

**Architecture:** Extend the existing typed selection-action pipeline instead of adding a new UI or message flow. The toolbar receives two new action metadata entries, and `buildSelectionPrompt(...)` receives two new instruction branches; background forwarding and floating-window streaming remain unchanged.

**Tech Stack:** WXT Chrome MV3 extension, TypeScript strict mode, React 19 for sidepanel/floating UI, DOM-based content-script toolbar, Vitest + jsdom.

---

## File Structure

- Modify: `src/lib/selection/types.ts`
  - Responsibility: define all valid selection action IDs.
- Modify: `src/lib/selection/actions.ts`
  - Responsibility: define toolbar action order, Vietnamese labels, and inline SVG icons.
- Modify: `src/lib/prompts/builders.ts`
  - Responsibility: map each `SelectionAction` to the Vietnamese AI instruction used by the existing prompt builder.
- Modify: `tests/selection/toolbar.test.ts`
  - Responsibility: verify toolbar rendering, accessibility labels, icon-only behavior, and emitted action IDs.
- Modify: `tests/prompts/builders.test.ts`
  - Responsibility: verify prompt text for the two new language-learning actions.
- Modify: `docs/modules/selection.md`
  - Responsibility: document the updated seven-action toolbar behavior.

No new runtime files are needed. Do not modify `entrypoints/active-tab-agent.ts`, `entrypoints/background.ts`, or `src/lib/floating-window/` unless tests reveal a type issue.

---

### Task 1: Add Failing Toolbar Tests For Seven Actions

**Files:**
- Modify: `tests/selection/toolbar.test.ts`
- Later implementation files: `src/lib/selection/types.ts`, `src/lib/selection/actions.ts`

- [ ] **Step 1: Update expected labels in the toolbar test**

Replace the `ACTION_LABELS` constant in `tests/selection/toolbar.test.ts` with:

```ts
const ACTION_LABELS = [
  "Giải thích",
  "Dịch sang tiếng Việt",
  "Viết lại chuyên nghiệp",
  "Tóm tắt",
  "Bullet/Action list",
  "Giải thích từ vựng",
  "Giải thích ngữ pháp"
];
```

- [ ] **Step 2: Update the toolbar button count expectation**

In the test named `renders five icon-only action buttons with Vietnamese accessible labels`, change the test name and count assertion to:

```ts
it("renders seven icon-only action buttons with Vietnamese accessible labels", () => {
  const toolbar = renderSelectionToolbar({ top: 10, left: 20 }, () => undefined);
  const buttons = Array.from(toolbar.querySelectorAll("button"));

  expect(buttons).toHaveLength(7);
  expect(toolbar.textContent).toBe("");

  buttons.forEach((button, index) => {
    expect(button.title).toBe(ACTION_LABELS[index]);
    expect(button.getAttribute("aria-label")).toBe(ACTION_LABELS[index]);
    expect(button.textContent).toBe("");

    const svg = button.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
  });
});
```

- [ ] **Step 3: Update click-callback coverage for the new action values**

Replace the test named `button click invokes onAction callback with correct action` with:

```ts
it("button click invokes onAction callback with correct action", () => {
  const actions: string[] = [];
  const toolbar = renderSelectionToolbar({ top: 10, left: 20 }, (action) => actions.push(action));
  const buttons = toolbar.querySelectorAll("button");

  buttons[0].click();
  expect(actions).toEqual(["explain"]);

  buttons[5].click();
  expect(actions).toEqual(["explain", "explain_vocabulary"]);

  buttons[6].click();
  expect(actions).toEqual(["explain", "explain_vocabulary", "explain_grammar"]);
});
```

- [ ] **Step 4: Run the toolbar test and verify it fails**

Run:

```sh
npm test -- tests/selection/toolbar.test.ts
```

Expected: FAIL because the toolbar still renders five buttons and the new action indexes do not exist.

- [ ] **Step 5: Commit the failing test**

```sh
git add tests/selection/toolbar.test.ts
git commit -m "test: cover vocabulary grammar toolbar actions"
```

---

### Task 2: Implement Selection Action Metadata

**Files:**
- Modify: `src/lib/selection/types.ts`
- Modify: `src/lib/selection/actions.ts`
- Test: `tests/selection/toolbar.test.ts`

- [ ] **Step 1: Extend the `SelectionAction` union**

Replace `src/lib/selection/types.ts` with:

```ts
export type SelectionAction =
  | "explain"
  | "translate_vi"
  | "rewrite_professional"
  | "summarize"
  | "action_list"
  | "explain_vocabulary"
  | "explain_grammar";
```

- [ ] **Step 2: Add the two action metadata entries**

In `src/lib/selection/actions.ts`, append these two objects after the existing `action_list` object. Add a comma after the `action_list` object before inserting these entries.

```ts
  {
    action: "explain_vocabulary",
    label: "Giải thích từ vựng",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h9"/><path d="M4 12h9"/><path d="M4 19h6"/><path d="M16 5h4"/><path d="M18 3v4"/><path d="m15 14 2 2 4-5"/><path d="M16 20h5"/></svg>`
  },
  {
    action: "explain_grammar",
    label: "Giải thích ngữ pháp",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h8"/><path d="M4 18h10"/><path d="M17 10v8"/><path d="m14 15 3 3 3-3"/><path d="M16 6l1-2 1 2 2 1-2 1-1 2-1-2-2-1Z"/></svg>`
  }
```

The final `SELECTION_ACTIONS` array should still export seven objects in this order: explain, translate, rewrite, summarize, action list, vocabulary, grammar.

- [ ] **Step 3: Run the toolbar test and verify it passes**

Run:

```sh
npm test -- tests/selection/toolbar.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit the implementation**

```sh
git add src/lib/selection/types.ts src/lib/selection/actions.ts tests/selection/toolbar.test.ts
git commit -m "feat: add vocabulary grammar selection actions"
```

---

### Task 3: Add Failing Prompt Builder Tests

**Files:**
- Modify: `tests/prompts/builders.test.ts`
- Later implementation file: `src/lib/prompts/builders.ts`

- [ ] **Step 1: Add a vocabulary prompt test**

Add this test after the existing translation selection prompt test:

```ts
it("builds a detailed vocabulary explanation selection prompt in Vietnamese", () => {
  const prompt = buildSelectionPrompt("explain_vocabulary", "resilient strategy");

  expect(prompt).toContain("từ vựng");
  expect(prompt).toContain("loại từ");
  expect(prompt).toContain("phát âm");
  expect(prompt).toContain("collocation");
  expect(prompt).toContain("resilient strategy");
});
```

- [ ] **Step 2: Add an English grammar prompt test**

Add this test immediately after the vocabulary test:

```ts
it("builds an English grammar explanation selection prompt in Vietnamese", () => {
  const prompt = buildSelectionPrompt("explain_grammar", "She has been working remotely since 2020.");

  expect(prompt).toContain("ngữ pháp tiếng Anh");
  expect(prompt).toContain("cấu trúc");
  expect(prompt).toContain("thì");
  expect(prompt).toContain("mệnh đề");
  expect(prompt).toContain("She has been working remotely since 2020.");
});
```

- [ ] **Step 3: Run prompt tests and verify they fail**

Run:

```sh
npm test -- tests/prompts/builders.test.ts
```

Expected: FAIL because `buildSelectionPrompt(...)` cannot yet map the new action values to instructions.

- [ ] **Step 4: Commit the failing prompt tests**

```sh
git add tests/prompts/builders.test.ts
git commit -m "test: cover vocabulary grammar selection prompts"
```

---

### Task 4: Implement Vocabulary And Grammar Prompts

**Files:**
- Modify: `src/lib/prompts/builders.ts`
- Test: `tests/prompts/builders.test.ts`

- [ ] **Step 1: Add `explain_vocabulary` instructions**

In `src/lib/prompts/builders.ts`, add this entry to `SELECTION_INSTRUCTIONS` after `action_list`. Add a comma after the existing `action_list` entry before inserting this block.

```ts
  explain_vocabulary: `
Hãy giải thích từ vựng trong đoạn được chọn như một trợ lý học ngoại ngữ chi tiết.

Trả lời bằng tiếng Việt theo cấu trúc:
1. Nghĩa trong ngữ cảnh
2. Loại từ
3. Phát âm nếu có thể xác định tự tin
4. Sắc thái nghĩa và cách dùng
5. Cụm từ liên quan hoặc collocation
6. Ví dụ ngắn
7. Lỗi dùng từ phổ biến nếu có

Yêu cầu:
- Bám sát đoạn văn bản được chọn.
- Nếu từ/cụm từ mơ hồ hoặc thiếu ngữ cảnh, hãy nói rõ điểm chưa chắc chắn.
- Không bịa nguồn gốc từ, phát âm, hoặc nghĩa không có cơ sở.
`.trim(),
```

- [ ] **Step 2: Add `explain_grammar` instructions**

Add this entry immediately after `explain_vocabulary` inside `SELECTION_INSTRUCTIONS`:

```ts
  explain_grammar: `
Hãy giải thích ngữ pháp tiếng Anh trong đoạn được chọn.

Trả lời bằng tiếng Việt theo cấu trúc:
1. Cấu trúc tổng thể của câu hoặc cụm từ
2. Thì, mệnh đề, cụm danh từ, cụm động từ, giới từ, liên từ hoặc thành phần bổ nghĩa nếu có
3. Vai trò của từng phần quan trọng
4. Điểm dễ nhầm hoặc lỗi người học thường gặp
5. Cách diễn đạt đơn giản hơn nếu hữu ích

Yêu cầu:
- Ưu tiên phân tích ngữ pháp tiếng Anh.
- Nếu đoạn được chọn không rõ là tiếng Anh, hãy nói rõ rằng phân tích ngữ pháp tiếng Anh có thể không áp dụng.
- Không ép phân tích khi văn bản quá ngắn hoặc thiếu cấu trúc.
`.trim(),
```

- [ ] **Step 3: Run prompt tests and verify they pass**

Run:

```sh
npm test -- tests/prompts/builders.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run toolbar and prompt tests together**

Run:

```sh
npm test -- tests/selection/toolbar.test.ts tests/prompts/builders.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the prompt implementation**

```sh
git add src/lib/prompts/builders.ts tests/prompts/builders.test.ts
git commit -m "feat: add vocabulary grammar selection prompts"
```

---

### Task 5: Update Selection Module Documentation

**Files:**
- Modify: `docs/modules/selection.md`

- [ ] **Step 1: Update the purpose description**

Replace the paragraph under `## Mục đích` with:

```md
Xử lý text selection trên trang web: hiển thị floating toolbar dạng icon-only với các action (giải thích, dịch, viết lại, tóm tắt, tạo action list, giải thích từ vựng, giải thích ngữ pháp), validate độ dài selection, và quản lý toolbar lifecycle.
```

- [ ] **Step 2: Update the `SelectionAction` union in docs**

Replace the TypeScript snippet under `## Types chính` with:

````md
```typescript
SelectionAction =
  | "explain"
  | "translate_vi"
  | "rewrite_professional"
  | "summarize"
  | "action_list"
  | "explain_vocabulary"
  | "explain_grammar"
```
````

- [ ] **Step 3: Update the action metadata description**

In the `## API Export` table, replace the `SELECTION_ACTIONS` description with:

```md
| `SELECTION_ACTIONS` | `{action, label, iconSvg}[]` | 7 actions với label tiếng Việt + inline SVG icon |
```

- [ ] **Step 4: Update the data flow valid-action line**

In `## Data Flow`, replace:

```md
2. Nếu 3-20,000 chars: `renderSelectionToolbar(position, onAction)` tại vị trí selection
```

with:

```md
2. Nếu 3-20,000 chars: `renderSelectionToolbar(position, onAction)` tại vị trí selection với 7 action icon-only
```

- [ ] **Step 5: Add language-learning notes**

Add these bullets to the end of `## Edge Cases / Lưu ý`:

```md
- `explain_vocabulary` dùng prompt học ngoại ngữ chi tiết: nghĩa theo ngữ cảnh, loại từ, phát âm nếu xác định được, sắc thái, collocation, ví dụ và lỗi dùng từ phổ biến.
- `explain_grammar` ưu tiên phân tích ngữ pháp tiếng Anh bằng tiếng Việt; nếu selection không rõ là tiếng Anh, prompt yêu cầu AI nói rõ giới hạn thay vì suy diễn.
```

- [ ] **Step 6: Commit documentation**

```sh
git add docs/modules/selection.md
git commit -m "docs: document vocabulary grammar selection actions"
```

---

### Task 6: Final Verification

**Files:**
- Verify: all modified implementation, test, and docs files

- [ ] **Step 1: Run focused tests**

Run:

```sh
npm test -- tests/selection/toolbar.test.ts tests/prompts/builders.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run type checking**

Run:

```sh
npm run compile
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run all tests**

Run:

```sh
npm test
```

Expected: PASS.

- [ ] **Step 4: Inspect git status**

Run:

```sh
git status --short
```

Expected: only intentional files are modified or no changes remain after commits. Do not stage unrelated existing untracked files.

- [ ] **Step 5: Commit any verification-only cleanup if needed**

Only run this if verification required small corrections to implementation, tests, or docs:

```sh
git add src/lib/selection/types.ts src/lib/selection/actions.ts src/lib/prompts/builders.ts tests/selection/toolbar.test.ts tests/prompts/builders.test.ts docs/modules/selection.md
git commit -m "chore: verify vocabulary grammar selection actions"
```

Expected: a commit is created only if there are actual intentional cleanup changes.

---

## Self-Review

- Spec coverage: The plan adds two toolbar actions, keeps existing actions, reuses the current selection pipeline, adds detailed vocabulary and English grammar prompts, updates tests, and updates module docs.
- Placeholder scan: All steps contain concrete file paths, commands, expected results, and code blocks where code changes are required.
- Type consistency: The new action IDs are consistently `explain_vocabulary` and `explain_grammar` across types, toolbar action metadata, prompt tests, prompt instructions, and docs.
