import { extractPageContent } from "../src/lib/extraction";
import { buildSelectionPrompt } from "../src/lib/prompts/builders";
import { isSelectionLengthAllowed, isSelectionTooLong, renderSelectionToolbar, renderTooLongIndicator } from "../src/lib/selection/toolbar";
import type { SelectionAction } from "../src/lib/selection/types";
import { mountFloatingWindow } from "../src/lib/floating-window/mount";

export default defineUnlistedScript(() => {
  if (window.__personalAiSidebarAgentInstalled) return;
  window.__personalAiSidebarAgentInstalled = true;

  let toolbar: HTMLElement | null = null;
  let tooLongIndicator: HTMLElement | null = null;
  let hideTimeoutId: number | null = null;
  let ignoreNextSelectionChange = false;

  function removeToolbar() {
    if (hideTimeoutId !== null) clearTimeout(hideTimeoutId);
    hideTimeoutId = null;
    
    if (toolbar) {
      const el = toolbar;
      el.style.opacity = "0";
      el.style.transform = "scale(0.95) translateY(4px)";
      setTimeout(() => el.remove(), 150);
      toolbar = null;
    }
    
    if (tooLongIndicator) {
      const el = tooLongIndicator;
      el.style.opacity = "0";
      el.style.transform = "scale(0.96) translateY(4px)";
      setTimeout(() => el.remove(), 150);
      tooLongIndicator = null;
    }
  }

  function currentSelectionText(): string {
    return window.getSelection()?.toString().trim() ?? "";
  }

  function selectionPosition(): { top: number; left: number } {
    const selection = window.getSelection();
    const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
    if (!rect) return { top: 8, left: 8 };

    const toolbarHeight = 42;
    const arrowHeight = 5;
    const gap = 6;

    if (rect.top >= toolbarHeight + gap) {
      return {
        top: Math.max(4, rect.top - toolbarHeight - gap - arrowHeight),
        left: Math.max(4, rect.left + rect.width / 2 - 140),
      };
    }

    return {
      top: Math.max(4, rect.bottom + gap + arrowHeight),
      left: Math.max(4, rect.left + rect.width / 2 - 140),
    };
  }

  function sendSelectionAction(action: SelectionAction, text: string) {
    const pos = selectionPosition();
    chrome.runtime.sendMessage({
      type: "SELECTION_ACTION",
      requestId: crypto.randomUUID(),
      action,
      text,
      url: window.location.href,
      title: document.title || "Untitled page",
      prompt: buildSelectionPrompt(action, text),
      position: { top: pos.top, left: pos.left }
    });
  }

  function showToolbar() {
    removeToolbar();
    const text = currentSelectionText();
    if (!text) return;

    if (isSelectionTooLong(text)) {
      const pos = selectionPosition();
      tooLongIndicator = renderTooLongIndicator({ top: pos.top, left: pos.left });
      document.body.appendChild(tooLongIndicator);
      return;
    }

    if (!isSelectionLengthAllowed(text)) return;

    toolbar = renderSelectionToolbar(selectionPosition(), (action) => {
      ignoreNextSelectionChange = true;
      sendSelectionAction(action, text);
      removeToolbar();
      window.getSelection()?.removeAllRanges();
    });
    document.body.appendChild(toolbar);
  }

  // Single source of truth: selectionchange drives all toolbar show/hide
  document.addEventListener("selectionchange", () => {
    if (ignoreNextSelectionChange) {
      ignoreNextSelectionChange = false;
      return;
    }

    // Debounce: wait for selection to settle before acting
    if (hideTimeoutId !== null) clearTimeout(hideTimeoutId);
    hideTimeoutId = window.setTimeout(() => {
      hideTimeoutId = null;
      showToolbar();
    }, 150);
  });

  // Hide toolbar on scroll
  document.addEventListener("scroll", removeToolbar, { passive: true });

  // Hide toolbar + clear selection on click outside toolbar
  document.addEventListener("mousedown", (event) => {
    if (toolbar && !toolbar.contains(event.target as Node)) {
      removeToolbar();
      window.getSelection()?.removeAllRanges();
    }
  });

  // Escape key dismisses toolbar
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toolbar) {
      removeToolbar();
    }
  });

  // Re-position or dismiss on resize
  window.addEventListener("resize", removeToolbar);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "FORWARD_SELECTION_ACTION") {
      mountFloatingWindow({
        position: message.actionPosition ?? { top: 200, left: 200 },
        prompt: message.prompt,
        requestId: message.requestId,
        title: message.title,
      });
      sendResponse({ ok: true });
      return true;
    }
    if (message.type === "EXTRACT_PAGE_CONTENT") {
      try {
        sendResponse(extractPageContent(window.location.href));
      } catch (e) {
        sendResponse({ error: String(e) });
      }
      return true;
    }
    return true;
  });
});
