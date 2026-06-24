import { extractPageContent } from "../src/lib/extraction";
import { buildSelectionPrompt } from "../src/lib/prompts/builders";
import { isSelectionLengthAllowed, isSelectionTooLong, renderSelectionToolbar, renderTooLongIndicator } from "../src/lib/selection/toolbar";
import type { SelectionAction } from "../src/lib/selection/types";

export default defineUnlistedScript(() => {
  if (window.__personalAiSidebarAgentInstalled) return;
  window.__personalAiSidebarAgentInstalled = true;

  let toolbar: HTMLElement | null = null;
  let tooLongIndicator: HTMLElement | null = null;
  let selectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let ignoreNextSelectionChange = false;

  function removeToolbar() {
    toolbar?.remove();
    toolbar = null;
    tooLongIndicator?.remove();
    tooLongIndicator = null;
  }

  function currentSelectionText(): string {
    return window.getSelection()?.toString().trim() ?? "";
  }

  function selectionPosition(): { top: number; left: number } {
    const selection = window.getSelection();
    const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
    if (!rect) return { top: 8, left: 8 };

    const aboveSpace = rect.top;
    const needed = 42 + 8;
    if (aboveSpace >= needed) {
      return {
        top: Math.max(8, rect.top - 42),
        left: Math.max(8, rect.left)
      };
    }
    return {
      top: Math.max(8, rect.bottom + 8),
      left: Math.max(8, rect.left)
    };
  }

  function sendSelectionAction(action: SelectionAction, text: string) {
    chrome.runtime.sendMessage({
      type: "SELECTION_ACTION",
      requestId: crypto.randomUUID(),
      action,
      text,
      url: window.location.href,
      title: document.title || "Untitled page",
      prompt: buildSelectionPrompt(action, text)
    });
  }

  document.addEventListener("selectionchange", () => {
    if (ignoreNextSelectionChange) {
      ignoreNextSelectionChange = false;
      return;
    }

    if (selectionTimeoutId !== null) clearTimeout(selectionTimeoutId);

    selectionTimeoutId = window.setTimeout(() => {
      selectionTimeoutId = null;
      removeToolbar();
      const text = currentSelectionText();
      if (!text) return;

      if (isSelectionTooLong(text)) {
        const pos = selectionPosition();
        tooLongIndicator = renderTooLongIndicator(pos);
        document.body.appendChild(tooLongIndicator);
        return;
      }

      if (!isSelectionLengthAllowed(text)) return;

      toolbar = renderSelectionToolbar(selectionPosition(), (action) => {
        ignoreNextSelectionChange = true;
        sendSelectionAction(action, text);
        removeToolbar();
      });
      document.body.appendChild(toolbar);
    }, 120);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "EXTRACT_PAGE_CONTENT") {
      try {
        sendResponse(extractPageContent(window.location.href));
      } catch (e) {
        sendResponse({ error: String(e) });
      }
    }
    return true;
  });
});
