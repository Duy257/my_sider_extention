import { SELECTION_ACTIONS } from "./actions";
import type { SelectionAction } from "./types";

const MIN_SELECTION_CHARS = 20;
const MAX_SELECTION_CHARS = 20000;

export function isSelectionLengthAllowed(text: string): boolean {
  const length = text.trim().length;
  return length >= MIN_SELECTION_CHARS && length <= MAX_SELECTION_CHARS;
}

export function isSelectionTooLong(text: string): boolean {
  return text.trim().length > MAX_SELECTION_CHARS;
}

export function renderSelectionToolbar(
  position: { top: number; left: number },
  onAction: (action: SelectionAction) => void
): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.dataset.personalAiToolbar = "true";
  toolbar.style.position = "fixed";
  toolbar.style.top = `${position.top}px`;
  toolbar.style.left = `${position.left}px`;
  toolbar.style.zIndex = "2147483647";
  toolbar.style.display = "flex";
  toolbar.style.gap = "4px";
  toolbar.style.padding = "6px";
  toolbar.style.border = "1px solid #3f3f46";
  toolbar.style.borderRadius = "6px";
  toolbar.style.background = "#18181b";
  toolbar.style.boxShadow = "0 8px 24px rgba(0,0,0,0.24)";

  for (const item of SELECTION_ACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = item.label;
    button.style.color = "#f4f4f5";
    button.style.background = "#27272a";
    button.style.border = "0";
    button.style.borderRadius = "4px";
    button.style.padding = "4px 6px";
    button.style.font = "12px system-ui, sans-serif";
    button.addEventListener("click", () => onAction(item.action));
    toolbar.appendChild(button);
  }

  return toolbar;
}
