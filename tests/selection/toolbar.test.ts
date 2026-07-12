import { describe, expect, it } from "vitest";
import { isSelectionLengthAllowed, isSelectionTooLong, renderSelectionToolbar, renderTooLongIndicator } from "../../src/core/selection/toolbar";

const ACTION_LABELS = [
  "Giải thích",
  "Dịch sang tiếng Việt",
  "Viết lại chuyên nghiệp",
  "Tóm tắt",
  "Bullet/Action list",
  "Giải thích từ vựng",
  "Giải thích ngữ pháp"
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
