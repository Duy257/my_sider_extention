import { fetchModels, streamChatCompletion, testConnection } from "../src/lib/ai/client";
import { resolveProviderRuntimeConfig } from "../src/lib/ai/runtime";
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
  // Inject content script on extension icon click (replaces side panel activation)
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id) injectContentAgent(tab.id);
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
        const runtime = resolveProviderRuntimeConfig(settings);

        if (!runtime.ok) {
          send({ type: "AI_STREAM_ERROR", requestId: message.requestId, message: runtime.error });
          return;
        }

        await streamChatCompletion({
          baseUrl: runtime.config.baseUrl,
          apiKey: runtime.config.apiKey,
          model: runtime.config.model,
          messages: message.messages,
          signal: controller.signal,
          callbacks: {
            onDelta: (delta) =>
              send({ type: "AI_STREAM_CHUNK", requestId: message.requestId, delta }),
            onDone: () => send({ type: "AI_STREAM_DONE", requestId: message.requestId }),
            onError: (errorMessage) =>
              send({ type: "AI_STREAM_ERROR", requestId: message.requestId, message: errorMessage })
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

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "ACTIVATE_ACTIVE_TAB_AGENT") {
      getActiveTab()
        .then((tab) => injectContentAgent(tab.id!))
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;
    }

    if (message.type === "LOAD_MODELS") {
      getSettings()
        .then(async (settings) => {
          const runtime = resolveProviderRuntimeConfig(settings);
          if (!runtime.ok) return { ok: false as const, error: runtime.error };
          const result = await fetchModels({ modelUrl: runtime.config.modelUrl, apiKey: runtime.config.apiKey });
          if ("models" in result) return { ok: true as const, models: result.models };
          return { ok: false as const, error: result.error };
        })
        .then(sendResponse);
      return true;
    }

    if (message.type === "TEST_CONNECTION") {
      getSettings()
        .then((settings) => {
          const runtime = resolveProviderRuntimeConfig(settings);
          if (!runtime.ok) return { ok: false as const, error: runtime.error };
          return testConnection({
            baseUrl: runtime.config.baseUrl,
            apiKey: runtime.config.apiKey,
            model: runtime.config.model
          });
        })
        .then(sendResponse);
      return true;
    }

    if (message.type === "SELECTION_ACTION") {
      // Forward to the active tab's content script (instead of side panel)
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: "FORWARD_SELECTION_ACTION",
          requestId: message.requestId,
          prompt: message.prompt,
          title: message.title,
          actionPosition: { top: message.position?.top ?? 200, left: message.position?.left ?? 200 }
        }).catch(() => undefined);
      }
      sendResponse({ ok: true });
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
