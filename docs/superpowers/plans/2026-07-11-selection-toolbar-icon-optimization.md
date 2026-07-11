# Selection Toolbar Icon Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the selection toolbar appear for selections of 3 or more characters and render five compact SVG icon-only action buttons.

**Architecture:** Keep the existing content-script, background routing, prompt, and floating-window flow unchanged. Localize the behavior change to `src/lib/selection/toolbar.ts`, replace action emoji metadata in `src/lib/selection/actions.ts`, then update focused unit tests and selection module docs.

**Tech Stack:** TypeScript 5, WXT, Chrome MV3 content scripts, Vitest, jsdom

---

## File Map

- `src/lib/selection/actions.ts`: owns the action registry used by the toolbar. Change the metadata shape from `{ action, label, icon }` to `{ action, label, iconSvg }` while keeping the same five `SelectionAction` values.
- `src/lib/selection/toolbar.ts`: owns selection length validation and DOM rendering for the toolbar and too-long indicator. Lower the minimum selection length and render each button with only an inline SVG.
- `src/lib/selection/types.ts`: no code change. The `SelectionAction` union remains the stable interface for action routing.
- `entrypoints/active-tab-agent.ts`: no code change expected. It continues to call `isSelectionLengthAllowed`, `isSelectionTooLong`, and `renderSelectionToolbar`.
- `tests/selection/toolbar.test.ts`: update unit coverage for the new threshold and icon-only accessibility expectations.
- `docs/modules/selection.md`: update module documentation after implementation.

---

### Task 1: Selection Toolbar Tests

**Files:**
- Modify: `tests/selection/toolbar.test.ts`

**Interfaces:**
- Consumes: `isSelectionLengthAllowed(text)`, `isSelectionTooLong(text)`, `renderSelectionToolbar(position, onAction)`, `renderTooLongIndicator(position)`
- Produces: failing tests that describe the new valid range and icon-only toolbar behavior

- [ ] **Step 1: Replace toolbar tests with the new expected behavior**

Edit `tests/selection/toolbar.test.ts` to this complete content:

```typescript
import { describe, expect, it } from "vitest";
import { isSelectionLengthAllowed, isSelectionTooLong, renderSelectionToolbar, renderTooLongIndicator } from "../../src/lib/selection/toolbar";

const ACTION_LABELS = [
  "Giải thích",
  "Dịch sang tiếng Việt",
  "Viết lại chuyên nghiệp",
  "Tóm tắt",
  "Bullet/Action list"
];

describe("selection toolbar", () => {
  it("accepts selections between 3 and 20000 characters", () => {
    expect(isSelectionLengthAllowed("a".repeat(2))).toBe(false);
    expect(isSelectionLengthAllowed("a".repeat(3))).toBe(true);
    expect(isSelectionLengthAllowed("a".repeat(20000))).toBe(true);
    expect(isSelectionLengthAllowed("a".repeat(20001))).toBe(false);
  });

  it("detects selections exceeding 20000 characters", () => {
    expect(isSelectionTooLong("a".repeat(20001))).toBe(true);
    expect(isSelectionTooLong("a".repeat(20000))).toBe(false);
    expect(isSelectionTooLong("a".repeat(20002))).toBe(true);
  });

  it("renders five icon-only action buttons with Vietnamese accessible labels", () => {
    const toolbar = renderSelectionToolbar({ top: 10, left: 20 }, () => undefined);
    const buttons = Array.from(toolbar.querySelectorAll("button"));

    expect(buttons).toHaveLength(5);
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

  it("button click invokes onAction callback with correct action", () => {
    const actions: string[] = [];
    const toolbar = renderSelectionToolbar({ top: 10, left: 20 }, (action) => actions.push(action));
    const buttons = toolbar.querySelectorAll("button");
    buttons[0].click();
    expect(actions).toEqual(["explain"]);
    buttons[4].click();
    expect(actions).toEqual(["explain", "action_list"]);
  });

  it("sets dataset.personalAiToolbar attribute", () => {
    const toolbar = renderSelectionToolbar({ top: 10, left: 20 }, () => undefined);
    expect(toolbar.dataset.personalAiToolbar).toBe("true");
  });

  it("handles empty and whitespace-only selection", () => {
    expect(isSelectionLengthAllowed("")).toBe(false);
    expect(isSelectionLengthAllowed("   ")).toBe(false);
    expect(isSelectionTooLong("")).toBe(false);
    expect(isSelectionTooLong("   ")).toBe(false);
  });

  it("renders too-long indicator pill with Vietnamese text", () => {
    const el = renderTooLongIndicator({ top: 100, left: 200 });
    expect(el.textContent).toBe("Văn bản quá dài (tối đa 20,000 ký tự)");
    expect(el.style.position).toBe("fixed");
    expect(el.style.top).toBe("100px");
    expect(el.style.left).toBe("200px");
  });

  it("positioning uses given coordinates as-is", () => {
    const el = renderTooLongIndicator({ top: 0, left: 0 });
    expect(el.style.top).toBe("0px");
    expect(el.style.left).toBe("0px");
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/selection/toolbar.test.ts --run`

Expected: FAIL. The current implementation still rejects 3-character selections, renders text labels, and does not render SVG icons.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/selection/toolbar.test.ts
git commit -m "test: cover compact selection toolbar behavior"
```

---

### Task 2: Icon-Only Toolbar Implementation

**Files:**
- Modify: `src/lib/selection/actions.ts`
- Modify: `src/lib/selection/toolbar.ts`
- Test: `tests/selection/toolbar.test.ts`

**Interfaces:**
- Consumes: existing `SelectionAction` values
- Produces: `SELECTION_ACTIONS` entries with `iconSvg`, a 3-character minimum threshold, and icon-only toolbar buttons

- [ ] **Step 1: Replace action emoji metadata with inline SVG metadata**

Edit `src/lib/selection/actions.ts` to this complete content:

```typescript
import type { SelectionAction } from "./types";

export const SELECTION_ACTIONS: Array<{ action: SelectionAction; label: string; iconSvg: string }> = [
  {
    action: "explain",
    label: "Giải thích",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.5 14.5c-1.3-1-2-2.5-2-4.1A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 5.5 5.4c0 1.6-.7 3.1-2 4.1-.8.6-1.2 1.4-1.3 2.5H9.8c-.1-1.1-.5-1.9-1.3-2.5Z"/></svg>`
  },
  {
    action: "translate_vi",
    label: "Dịch sang tiếng Việt",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h12"/><path d="M9 3v2"/><path d="M6 9c1.2 2.2 3.2 3.8 6 5"/><path d="M13 5c-.8 3.4-3.1 6.5-7 9"/><path d="M14 19l4-9 4 9"/><path d="M15.5 16h5"/></svg>`
  },
  {
    action: "rewrite_professional",
    label: "Viết lại chuyên nghiệp",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/><path d="m15 5 3 3"/></svg>`
  },
  {
    action: "summarize",
    label: "Tóm tắt",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16"/><path d="M4 12h10"/><path d="M4 19h7"/><path d="m17 15 3 3-3 3"/></svg>`
  },
  {
    action: "action_list",
    label: "Bullet/Action list",
    iconSvg: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/></svg>`
  }
];
```

- [ ] **Step 2: Update toolbar threshold and icon-only button rendering**

Edit `src/lib/selection/toolbar.ts` to this complete content:

```typescript
import { SELECTION_ACTIONS } from "./actions";
import type { SelectionAction } from "./types";

const MIN_SELECTION_CHARS = 3;
const MAX_SELECTION_CHARS = 20000;

export function isSelectionLengthAllowed(text: string): boolean {
  const length = text.trim().length;
  return length >= MIN_SELECTION_CHARS && length <= MAX_SELECTION_CHARS;
}

export function isSelectionTooLong(text: string): boolean {
  return text.trim().length > MAX_SELECTION_CHARS;
}

export function renderTooLongIndicator(
  position: { top: number; left: number }
): HTMLElement {
  const el = document.createElement("div");
  el.dataset.personalAiToolbar = "true";
  el.style.position = "fixed";
  el.style.top = `${position.top}px`;
  el.style.left = `${position.left}px`;
  el.style.zIndex = "2147483647";
  el.style.padding = "8px 14px";
  el.style.border = "1px solid rgba(245, 158, 11, 0.45)";
  el.style.borderRadius = "10px";
  el.style.background = "rgba(41, 37, 36, 0.95)";
  el.style.color = "#fbbf24";
  el.style.font = "500 12.5px 'Plus Jakarta Sans', system-ui, sans-serif";
  el.style.boxShadow = "0 8px 28px rgba(0, 0, 0, 0.35)";
  el.style.backdropFilter = "blur(12px)";
  el.style.whiteSpace = "nowrap";
  el.style.opacity = "0";
  el.style.transform = "scale(0.96) translateY(4px)";
  el.style.transition = "opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
  el.textContent = "Văn bản quá dài (tối đa 20,000 ký tự)";

  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "scale(1) translateY(0)";
  });

  return el;
}

export function renderSelectionToolbar(
  position: { top: number; left: number },
  onAction: (action: SelectionAction) => void,
  onDismiss?: () => void
): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.dataset.personalAiToolbar = "true";
  toolbar.style.position = "fixed";
  toolbar.style.top = `${position.top}px`;
  toolbar.style.left = `${position.left}px`;
  toolbar.style.zIndex = "2147483647";
  toolbar.style.display = "flex";
  toolbar.style.alignItems = "center";
  toolbar.style.gap = "2px";
  toolbar.style.padding = "5px 7px";
  toolbar.style.border = "1px solid rgba(68, 64, 60, 0.5)";
  toolbar.style.borderRadius = "14px";
  toolbar.style.background = "rgba(28, 25, 23, 0.96)";
  toolbar.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.4)";
  toolbar.style.backdropFilter = "blur(12px)";
  toolbar.style.whiteSpace = "nowrap";
  toolbar.style.opacity = "0";
  toolbar.style.transform = "scale(0.95) translateY(4px)";
  toolbar.style.transition = "opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";

  const arrow = document.createElement("div");
  arrow.style.position = "absolute";
  arrow.style.width = "8px";
  arrow.style.height = "8px";
  arrow.style.background = "rgba(28, 25, 23, 0.96)";
  arrow.style.borderLeft = "1px solid rgba(68, 64, 60, 0.5)";
  arrow.style.borderTop = "1px solid rgba(68, 64, 60, 0.5)";
  arrow.style.transform = "rotate(45deg)";
  arrow.style.bottom = "-5px";
  arrow.style.left = "50%";
  arrow.style.marginLeft = "-4px";
  arrow.style.zIndex = "-1";
  toolbar.appendChild(arrow);

  for (const item of SELECTION_ACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = item.label;
    button.setAttribute("aria-label", item.label);
    button.innerHTML = item.iconSvg;
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.justifyContent = "center";
    button.style.width = "32px";
    button.style.height = "32px";
    button.style.color = "#FAFAF9";
    button.style.background = "transparent";
    button.style.border = "0";
    button.style.borderRadius = "9px";
    button.style.padding = "0";
    button.style.font = "12px 'Plus Jakarta Sans', system-ui, sans-serif";
    button.style.cursor = "pointer";
    button.style.transition = "background 0.2s, transform 0.1s";

    const svg = button.querySelector("svg");
    if (svg) {
      svg.style.width = "16px";
      svg.style.height = "16px";
      svg.style.display = "block";
      svg.style.flexShrink = "0";
    }

    button.addEventListener("mouseenter", () => {
      button.style.background = "#3C3833";
    });
    button.addEventListener("mouseleave", () => {
      button.style.background = "transparent";
    });
    button.addEventListener("mousedown", () => {
      button.style.transform = "scale(0.96)";
    });
    button.addEventListener("mouseup", () => {
      button.style.transform = "scale(1)";
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onAction(item.action);
    });
    toolbar.appendChild(button);

    if (item !== SELECTION_ACTIONS[SELECTION_ACTIONS.length - 1]) {
      const divider = document.createElement("span");
      divider.style.width = "1px";
      divider.style.height = "16px";
      divider.style.background = "rgba(68, 64, 60, 0.6)";
      divider.style.margin = "0 3px";
      toolbar.appendChild(divider);
    }
  }

  requestAnimationFrame(() => {
    toolbar.style.opacity = "1";
    toolbar.style.transform = "scale(1) translateY(0)";
  });

  return toolbar;
}
```

- [ ] **Step 3: Run the focused test to verify it passes**

Run: `npm test -- tests/selection/toolbar.test.ts --run`

Expected: PASS for all tests in `tests/selection/toolbar.test.ts`.

- [ ] **Step 4: Run type checking**

Run: `npm run compile`

Expected: exits 0 with no TypeScript errors. This verifies the `iconSvg` metadata shape is consistent between `actions.ts` and `toolbar.ts`.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/lib/selection/actions.ts src/lib/selection/toolbar.ts tests/selection/toolbar.test.ts
git commit -m "feat: compact selection toolbar with svg icons"
```

---

### Task 3: Documentation and Full Verification

**Files:**
- Modify: `docs/modules/selection.md`
- Test: full project verification commands

**Interfaces:**
- Consumes: implemented behavior from Task 2
- Produces: updated module docs and final verification evidence

- [ ] **Step 1: Update selection module documentation**

Edit `docs/modules/selection.md` to this complete content:

````markdown
# Selection Module

`src/lib/selection/`

## Mục đích

Xử lý text selection trên trang web: hiển thị floating toolbar dạng icon-only với các action (giải thích, dịch, viết lại...), validate độ dài selection, và quản lý toolbar lifecycle.

## Types chính

```typescript
SelectionAction = "explain" | "translate_vi" | "rewrite_professional" | "summarize" | "action_list"
```

## API Export

| Export | Kiểu / Chữ ký | Mô tả |
|--------|---------------|-------|
| `SELECTION_ACTIONS` | `{action, label, iconSvg}[]` | 5 actions với label tiếng Việt + inline SVG icon |
| `isSelectionLengthAllowed(text)` | `string -> boolean` | Check selection 3-20,000 ký tự |
| `isSelectionTooLong(text)` | `string -> boolean` | Check selection > 20,000 ký tự |
| `renderSelectionToolbar(position, onAction, onDismiss?)` | `-> HTMLElement` | Render floating icon-only toolbar tại position |
| `renderTooLongIndicator(position)` | `-> HTMLElement` | Render indicator "Văn bản quá dài" |

## Data Flow

1. User select text -> content script detect selection -> check length
2. Nếu 3-20,000 chars: `renderSelectionToolbar(position, onAction)` tại vị trí selection
3. Nếu > 20,000 chars: `renderTooLongIndicator(position)` thông báo quá dài
4. Nếu rỗng hoặc < 3 chars: không hiển thị toolbar
5. User click action -> toolbar gọi `onAction(action)` -> background xử lý
6. Toolbar tự huỷ khi: scroll, resize, click outside, hoặc Escape
7. CSS selector cleanup: `document.querySelectorAll('[data-personal-ai-toolbar]').forEach(el => el.remove())`

## Dependencies

- Không depend vào module internal nào khác

## Edge Cases / Lưu ý

- `MIN_SELECTION_CHARS = 3`, `MAX_SELECTION_CHARS = 20000`
- Toolbar dùng `position: fixed`, z-index `2147483647` (cao nhất)
- Toolbar có arrow nhỏ hướng xuống selection
- Toolbar button chỉ render inline SVG icon; không render text label trong button body
- Mỗi button vẫn có `title` và `aria-label` tiếng Việt để hỗ trợ hover tooltip và accessibility
- SVG icons dùng `currentColor`, `aria-hidden="true"`, và `focusable="false"`
- Mỗi button trong toolbar có hover (surface-hover), mousedown (scale 0.96), click handlers
- Entrance animation: opacity 0->1 + scale 0.95->1 + translateY 4px->0 với cubic-bezier(0.16, 1, 0.3, 1)
- Toolbar elements đều có `dataset.personalAiToolbar = "true"` để dễ cleanup
````

- [ ] **Step 2: Run focused selection tests**

Run: `npm test -- tests/selection/toolbar.test.ts --run`

Expected: PASS.

- [ ] **Step 3: Run active tab agent regression tests**

Run: `npm test -- tests/active-tab-agent.test.ts --run`

Expected: PASS. This confirms the content script listener setup remains stable after the toolbar contract change.

- [ ] **Step 4: Run type checking**

Run: `npm run compile`

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 5: Run all tests once**

Run: `npm test -- --run`

Expected: exits 0 with the complete Vitest suite passing.

- [ ] **Step 6: Inspect final diff**

Run: `git diff --stat`

Expected: only these files changed:

```text
docs/modules/selection.md
src/lib/selection/actions.ts
src/lib/selection/toolbar.ts
tests/selection/toolbar.test.ts
```

- [ ] **Step 7: Commit docs and final verified state**

```bash
git add docs/modules/selection.md
git commit -m "docs: update selection toolbar module docs"
```

---

## Plan Self-Review

- Spec coverage: Task 1 covers the new threshold and icon-only expectations; Task 2 implements the threshold, inline SVG action metadata, `title`, and `aria-label`; Task 3 updates docs and runs focused plus full verification.
- Red-flag scan: all code-bearing steps include exact file paths, complete replacement snippets, exact commands, and expected outcomes.
- Type consistency: `iconSvg` is introduced in `actions.ts` and consumed in `toolbar.ts`; `SelectionAction` remains unchanged; no background or floating-window contract changes are introduced.
