import { streamOpenAIResponse } from "../src/lib/ai/openai";
import { resolveSelectedModel } from "../src/lib/ai/stream";
import { AI_STREAM_PORT } from "../src/lib/messaging/ports";
import type { AiPortRequest } from "../src/lib/messaging/types";
import { getSettings } from "../src/lib/storage";

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab is available.");
  return tab;
}

const injectedTabs = new Set<number>();

async function injectContentAgent(tabId: number) {
  if (injectedTabs.has(tabId)) return;
  injectedTabs.add(tabId);
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["/active-tab-agent.js"]
  });
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== AI_STREAM_PORT) return;

    const controller = new AbortController();
    let busy = false;

    port.onDisconnect.addListener(() => {
      controller.abort();
    });

    port.onMessage.addListener(async (message: AiPortRequest) => {
      if (message.type !== "AI_CHAT_REQUEST") return;
      if (busy) return;
      busy = true;

      const send = (msg: Record<string, unknown>) => {
        try { port.postMessage(msg); } catch {}
      };

      try {
        const settings = await getSettings();
        const apiKey = settings.openaiApiKey?.trim();

        if (!apiKey) {
          send({
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
              send({ type: "AI_STREAM_CHUNK", requestId: message.requestId, delta }),
            onDone: () => send({ type: "AI_STREAM_DONE", requestId: message.requestId }),
            onError: (errorMessage) =>
              send({
                type: "AI_STREAM_ERROR",
                requestId: message.requestId,
                message: errorMessage
              })
          }
        });
      } catch (error) {
        send({
          type: "AI_STREAM_ERROR",
          requestId: message.requestId,
          message: error instanceof Error ? error.message : "Unexpected streaming error."
        });
      } finally {
        busy = false;
      }
    });
  });

  const pendingSelectionPrompts: { requestId: string; prompt: string; title: string }[] = [];

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SELECTION_ACTION") {
      pendingSelectionPrompts.push({
        requestId: message.requestId,
        prompt: message.prompt,
        title: message.title
      });
      if (sender.tab?.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id }).catch((err) =>
          console.warn("Failed to open side panel:", err)
        );
      }
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "GET_PENDING_SELECTION_PROMPT") {
      const value = pendingSelectionPrompts.shift() ?? null;
      sendResponse(value);
      return true;
    }

    if (message.type === "EXTRACT_ACTIVE_PAGE") {
      getActiveTab()
        .then(async (tab) => {
          await injectContentAgent(tab.id!);
          let lastError: unknown;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id!, { type: "EXTRACT_PAGE_CONTENT" });
              sendResponse(response);
              return;
            } catch (err) {
              lastError = err;
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
          sendResponse({ error: lastError instanceof Error ? lastError.message : "Content script not ready after retries." });
        })
        .catch((error) => sendResponse({ error: error instanceof Error ? error.message : "Page extraction failed." }));
      return true;
    }

    return false;
  });
});
