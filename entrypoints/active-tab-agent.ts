import { extractPageContent } from "../src/lib/extraction";
import { buildSelectionPrompt } from "../src/lib/prompts/builders";
import { isSelectionLengthAllowed, isSelectionTooLong, renderSelectionToolbar } from "../src/lib/selection/toolbar";
import type { SelectionAction } from "../src/lib/selection/types";

export default defineUnlistedScript(() => {
  if (window.__personalAiSidebarAgentInstalled) return;
  window.__personalAiSidebarAgentInstalled = true;

  let toolbar: HTMLElement | null = null;

  function removeToolbar() {
    toolbar?.remove();
    toolbar = null;
  }

  function currentSelectionText(): string {
    return window.getSelection()?.toString().trim() ?? "";
  }

  function selectionPosition(): { top: number; left: number } {
    const selection = window.getSelection();
    const rect = selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
    return {
      top: Math.max(8, rect ? rect.top - 42 : 8),
      left: Math.max(8, rect ? rect.left : 8)
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
    window.setTimeout(() => {
      removeToolbar();
      const text = currentSelectionText();
      if (!text) return;

      if (isSelectionTooLong(text)) {
        chrome.runtime.sendMessage({
          type: "SELECTION_TOO_LONG",
          requestId: crypto.randomUUID(),
          length: text.length
        });
        return;
      }

      if (!isSelectionLengthAllowed(text)) return;

      toolbar = renderSelectionToolbar(selectionPosition(), (action) => {
        sendSelectionAction(action, text);
        removeToolbar();
      });
      document.body.appendChild(toolbar);
    }, 120);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "EXTRACT_PAGE_CONTENT") {
      sendResponse(extractPageContent(window.location.href));
    }
    return true;
  });
});
