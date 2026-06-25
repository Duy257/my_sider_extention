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
  el.style.padding = "8px 14px";
  el.style.border = "1px solid rgba(245, 158, 11, 0.45)"; // amber border
  el.style.borderRadius = "10px";
  el.style.background = "rgba(41, 37, 36, 0.95)"; // stone-800 / surface
  el.style.color = "#fbbf24"; // amber-400
  el.style.font = "500 12.5px 'Plus Jakarta Sans', system-ui, sans-serif";
  el.style.boxShadow = "0 8px 28px rgba(0, 0, 0, 0.35)";
  el.style.backdropFilter = "blur(12px)";
  el.style.whiteSpace = "nowrap";
  el.style.opacity = "0";
  el.style.transform = "scale(0.96) translateY(4px)";
  el.style.transition = "opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
  el.textContent = "Văn bản quá dài (tối đa 20,000 ký tự)";

  // Trigger entrance transition
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
  toolbar.style.border = "1px solid rgba(68, 64, 60, 0.5)"; // border
  toolbar.style.borderRadius = "14px";
  toolbar.style.background = "rgba(28, 25, 23, 0.96)"; // warm-bg
  toolbar.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.4)";
  toolbar.style.backdropFilter = "blur(12px)";
  toolbar.style.whiteSpace = "nowrap";
  toolbar.style.opacity = "0";
  toolbar.style.transform = "scale(0.95) translateY(4px)";
  toolbar.style.transition = "opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";

  // Small arrow pointing toward the selection
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
    button.innerHTML = `<span style="font-size:14px;line-height:1;margin-right:4px">${item.icon}</span><span style="font-weight:600">${item.label}</span>`;
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.color = "#FAFAF9"; // stone-50
    button.style.background = "transparent";
    button.style.border = "0";
    button.style.borderRadius = "9px";
    button.style.padding = "6px 9px";
    button.style.font = "12px 'Plus Jakarta Sans', system-ui, sans-serif";
    button.style.cursor = "pointer";
    button.style.transition = "background 0.2s, transform 0.1s active";
    
    button.addEventListener("mouseenter", () => {
      button.style.background = "#3C3833"; // surface-hover
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

    // Divider between buttons (except last)
    if (item !== SELECTION_ACTIONS[SELECTION_ACTIONS.length - 1]) {
      const divider = document.createElement("span");
      divider.style.width = "1px";
      divider.style.height = "16px";
      divider.style.background = "rgba(68, 64, 60, 0.6)"; // border
      divider.style.margin = "0 3px";
      toolbar.appendChild(divider);
    }
  }

  // Trigger entrance transition
  requestAnimationFrame(() => {
    toolbar.style.opacity = "1";
    toolbar.style.transform = "scale(1) translateY(0)";
  });

  return toolbar;
}
