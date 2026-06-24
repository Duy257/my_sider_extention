import { streamOpenAIResponse } from "../src/lib/ai/openai";
import { resolveSelectedModel } from "../src/lib/ai/stream";
import { AI_STREAM_PORT } from "../src/lib/messaging/ports";
import type { AiPortRequest } from "../src/lib/messaging/types";
import { getSettings } from "../src/lib/storage";

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== AI_STREAM_PORT) return;

    const controller = new AbortController();

    port.onDisconnect.addListener(() => {
      controller.abort();
    });

    port.onMessage.addListener(async (message: AiPortRequest) => {
      if (message.type !== "AI_CHAT_REQUEST") return;

      const settings = await getSettings();
      const apiKey = settings.openaiApiKey?.trim();

      if (!apiKey) {
        port.postMessage({
          type: "AI_STREAM_ERROR",
          requestId: message.requestId,
          message: "Add your OpenAI API key in Settings before sending a request."
        });
        return;
      }

      await streamOpenAIResponse({
        apiKey,
        model: resolveSelectedModel(message.model, settings.customModel),
        messages: message.messages,
        signal: controller.signal,
        callbacks: {
          onDelta: (delta) =>
            port.postMessage({ type: "AI_STREAM_CHUNK", requestId: message.requestId, delta }),
          onDone: () => port.postMessage({ type: "AI_STREAM_DONE", requestId: message.requestId }),
          onError: (errorMessage) =>
            port.postMessage({
              type: "AI_STREAM_ERROR",
              requestId: message.requestId,
              message: errorMessage
            })
        }
      });
    });
  });

  let pendingSelectionPrompt: { requestId: string; prompt: string; title: string } | null = null;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SELECTION_ACTION") {
      pendingSelectionPrompt = {
        requestId: message.requestId,
        prompt: message.prompt,
        title: message.title
      };
      if (sender.tab?.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => undefined);
      }
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "GET_PENDING_SELECTION_PROMPT") {
      const value = pendingSelectionPrompt;
      pendingSelectionPrompt = null;
      sendResponse(value);
      return true;
    }

    return false;
  });
});
