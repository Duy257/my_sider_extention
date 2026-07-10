import { fetchModels, streamChatCompletion, testConnection } from "../src/lib/ai/client";
import { getThinkingParams, resolveProviderRuntimeConfig } from "../src/lib/ai/runtime";
import { AI_STREAM_PORT } from "../src/lib/messaging/ports";
import type { AiPortRequest, ExtensionMessage } from "../src/lib/messaging/types";
import { getSettings } from "../src/lib/storage";
import type { Settings } from "../src/lib/storage/types";

let settingsCache: { settings: Settings; timestamp: number } | null = null;
const SETTINGS_CACHE_TTL = 5_000; // 5 seconds

async function getCachedSettings(): Promise<Settings> {
  const now = Date.now();
  if (settingsCache && (now - settingsCache.timestamp) < SETTINGS_CACHE_TTL) {
    return settingsCache.settings;
  }
  const settings = await getSettings();
  settingsCache = { settings, timestamp: now };
  return settings;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab is available.");
  return tab;
}

const injectedTabs = new Set<number>();

async function injectContentAgent(tabId: number) {
  if (injectedTabs.has(tabId)) return;
  injectedTabs.add(tabId);
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["/active-tab-agent.js"]
    });
    // Set badge text to ON to give visual feedback to the user
    chrome.action.setBadgeText({ tabId, text: "ON" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#8B5CF6" }); // Violet color
  } catch (err) {
    injectedTabs.delete(tabId);
    console.error("Failed to inject content agent:", err);
    // Set badge text to ERR to indicate failure (e.g. on chrome:// pages)
    chrome.action.setBadgeText({ tabId, text: "ERR" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#EF4444" }); // Red color
  }
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    chrome.contextMenus.create({
      id: "read-with-ai",
      title: "Đọc với AI",
      contexts: ["page"],
    });
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
        const settings = await getCachedSettings();
        const runtime = resolveProviderRuntimeConfig(settings);

        if (!runtime.ok) {
          send({ type: "AI_STREAM_ERROR", requestId: message.requestId, message: runtime.error });
          return;
        }

        const thinkingMode = message.thinkingMode ?? runtime.config.thinkingMode;
        const extraBodyParams = getThinkingParams(runtime.config.providerId, thinkingMode);

        await streamChatCompletion({
          baseUrl: runtime.config.baseUrl,
          apiKey: runtime.config.apiKey,
          model: runtime.config.model,
          messages: message.messages,
          extraBodyParams,
          signal: controller.signal,
          callbacks: {
            onConnecting: () =>
              send({ type: "AI_STREAM_CONNECTING", requestId: message.requestId }),
            onFirstToken: () =>
              send({ type: "AI_STREAM_FIRST_TOKEN", requestId: message.requestId }),
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

    if (message.type === "OPEN_READING_COMPANION") {
      getActiveTab()
        .then(async (tab) => {
          await injectContentAgent(tab.id!);
          let lastError: unknown;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id!, { type: "EXTRACT_PAGE_CONTENT" });
              if (response?.error) {
                sendResponse({ error: response.error });
                return;
              }
              const readerTab = await chrome.tabs.create({ url: chrome.runtime.getURL(`/reader.html?requestId=${message.requestId}`) });
              const readerReady = (msg: any) => {
                if (msg.type === "READER_CONTENT_READY" && msg.requestId === message.requestId) {
                  chrome.runtime.onMessage.removeListener(readerReady);
                  if (!response || !tab) return;
                  chrome.tabs.sendMessage(readerTab.id!, {
                    type: "LOAD_READER_CONTENT",
                    requestId: message.requestId,
                    title: response.title || tab.title || "",
                    url: response.url || tab.url || "",
                    content: response.text || response.content || "",
                    excerpt: response.excerpt || "",
                  }).catch(() => undefined);
                }
              };
              chrome.runtime.onMessage.addListener(readerReady);
              sendResponse({ ok: true });
              return;
            } catch (err) {
              lastError = err;
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
          sendResponse({ error: lastError instanceof Error ? lastError.message : "Content script not ready." });
        })
        .catch((error) => sendResponse({ error: String(error) }));
      return true;
    }

    if (message.type === "READER_SAVE_SESSION") {
      import("../src/lib/storage/index").then(({ getSavedResults, saveSavedResults }) => {
        getSavedResults().then((results) => {
          const newResult = {
            id: crypto.randomUUID(),
            title: message.title || "Reading Session",
            sourceType: "page",
            sourceUrl: message.url || "",
            sourceTitle: message.title || "",
            outputMarkdown: message.summary || "",
            createdAt: message.date || new Date().toISOString(),
          } satisfies import("../src/lib/storage/types").SavedResult;
          saveSavedResults([newResult, ...results]).then(() => {
            sendResponse({ ok: true });
          });
        });
      }).catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type === "SETTINGS_UPDATED") {
      settingsCache = null;
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "read-with-ai" && tab?.id) {
      const requestId = crypto.randomUUID();
      chrome.runtime.sendMessage({ type: "OPEN_READING_COMPANION", requestId }).catch(() => {});
    }
  });
});
