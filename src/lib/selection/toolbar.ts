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

export function renderTooLongIndicator(
  position: { top: number; left: number }
): HTMLElement {
  const el = document.createElement("div");
  el.dataset.personalAiToolbar = "true";
  el.style.position = "fixed";
  el.style.top = `${position.top}px`;
  el.style.left = `${position.left}px`;
  el.style.zIndex = "2147483647";
  el.style.padding = "6px 12px";
  el.style.border = "1px solid #f59e0b";
  el.style.borderRadius = "6px";
  el.style.background = "#18181b";
  el.style.color = "#fbbf24";
  el.style.font = "12px system-ui, sans-serif";
  el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.24)";
  el.style.whiteSpace = "nowrap";
  el.textContent = "Văn bản quá dài (tối đa 20,000 ký tự)";
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
  toolbar.style.padding = "4px 6px";
  toolbar.style.border = "1px solid #3f3f46";
  toolbar.style.borderRadius = "8px";
  toolbar.style.background = "#18181b";
  toolbar.style.boxShadow = "0 8px 24px rgba(0,0,0,0.32)";
  toolbar.style.backdropFilter = "blur(8px)";
  toolbar.style.whiteSpace = "nowrap";

  // Small arrow pointing toward the selection
  const arrow = document.createElement("div");
  arrow.style.position = "absolute";
  arrow.style.width = "8px";
  arrow.style.height = "8px";
  arrow.style.background = "#18181b";
  arrow.style.borderLeft = "1px solid #3f3f46";
  arrow.style.borderTop = "1px solid #3f3f46";
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
    button.innerHTML = `<span style="font-size:14px;line-height:1">${item.icon}</span><span style="margin-left:4px">${item.label}</span>`;
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.color = "#e4e4e7";
    button.style.background = "transparent";
    button.style.border = "0";
    button.style.borderRadius = "6px";
    button.style.padding = "6px 8px";
    button.style.font = "12px system-ui, sans-serif";
    button.style.cursor = "pointer";
    button.style.transition = "background 0.15s";
    button.addEventListener("mouseenter", () => {
      button.style.background = "#27272a";
    });
    button.addEventListener("mouseleave", () => {
      button.style.background = "transparent";
    });
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onAction(item.action);
    });
    toolbar.appendChild(button);

    // Divider between buttons (except last)
    if (item !== SELECTION_ACTIONS[SELECTION_ACTIONS.length - 1]) {
      const divider = document.createElement("span");
      divider.style.width = "1px";
      divider.style.height = "16px";
      divider.style.background = "#3f3f46";
      divider.style.margin = "0 2px";
      toolbar.appendChild(divider);
    }
  }

  return toolbar;
}
