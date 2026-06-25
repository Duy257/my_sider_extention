import { describe, expect, it } from "vitest";
import { isSelectionLengthAllowed, isSelectionTooLong, renderSelectionToolbar, renderTooLongIndicator } from "../../src/lib/selection/toolbar";

describe("selection toolbar", () => {
  it("accepts selections between 20 and 20000 characters", () => {
    expect(isSelectionLengthAllowed("a".repeat(19))).toBe(false);
    expect(isSelectionLengthAllowed("a".repeat(20))).toBe(true);
    expect(isSelectionLengthAllowed("a".repeat(20000))).toBe(true);
    expect(isSelectionLengthAllowed("a".repeat(20001))).toBe(false);
  });

  it("detects selections exceeding 20000 characters", () => {
    expect(isSelectionTooLong("a".repeat(20001))).toBe(true);
    expect(isSelectionTooLong("a".repeat(20000))).toBe(false);
    expect(isSelectionTooLong("a".repeat(20002))).toBe(true);
  });

  it("renders five action buttons with Vietnamese labels", () => {
    const toolbar = renderSelectionToolbar({ top: 10, left: 20 }, () => undefined);

    expect(toolbar.querySelectorAll("button")).toHaveLength(5);
    expect(toolbar.textContent).toContain("Giải thích");
    expect(toolbar.textContent).toContain("Dịch sang tiếng Việt");
    expect(toolbar.textContent).toContain("Viết lại chuyên nghiệp");
    expect(toolbar.textContent).toContain("Tóm tắt");
    expect(toolbar.textContent).toContain("Bullet/Action list");
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
