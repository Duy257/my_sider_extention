import { describe, expect, it } from "vitest";
import { isSelectionLengthAllowed, renderSelectionToolbar } from "../../src/lib/selection/toolbar";

describe("selection toolbar", () => {
  it("accepts selections between 20 and 20000 characters", () => {
    expect(isSelectionLengthAllowed("a".repeat(19))).toBe(false);
    expect(isSelectionLengthAllowed("a".repeat(20))).toBe(true);
    expect(isSelectionLengthAllowed("a".repeat(20000))).toBe(true);
    expect(isSelectionLengthAllowed("a".repeat(20001))).toBe(false);
  });

  it("renders five action buttons", () => {
    const toolbar = renderSelectionToolbar({ top: 10, left: 20 }, () => undefined);

    expect(toolbar.querySelectorAll("button")).toHaveLength(5);
    expect(toolbar.textContent).toContain("Explain");
    expect(toolbar.textContent).toContain("Translate VI");
  });
});
