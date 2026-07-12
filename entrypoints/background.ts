import { fetchModels, streamChatCompletion, testConnection } from "../src/core/ai/client";
import { getThinkingParams, resolveProviderRuntimeConfig, getDevStreamParams } from "../src/core/ai/runtime";
import { AI_STREAM_PORT } from "../src/core/messaging/ports";
import type { AiPortRequest, ExtensionMessage } from "../src/core/messaging/types";
import { getSettings } from "../src/core/storage";
import type { Settings } from "../src/core/storage/types";
import { createAiTrace, createAiPortTraceEmitter, createToolTrace, completeToolTrace, failToolTrace } from "../src/core/devtools/background-trace";

let settingsCache: { settings: Settings; timestamp: number } | null = null;
const SETTINGS_CACHE_TTL = 5_000; // 5 seconds
const READER_HANDOFF_TIMEOUT_MS = 10_000;

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

      let emitter: ReturnType<typeof createAiPortTraceEmitter> | undefined;

      try {
        const settings = await getCachedSettings();
        const runtime = resolveProviderRuntimeConfig(settings);

        if (!runtime.ok) {
          send({ type: "AI_STREAM_ERROR", requestId: message.requestId, message: runtime.error });
          return;
        }

        const thinkingMode = message.thinkingMode ?? runtime.config.thinkingMode;
        const thinkingParams = getThinkingParams(runtime.config.providerId, thinkingMode, runtime.config.model);
        const devStreamParams = getDevStreamParams(runtime.config.providerId, runtime.config.devMode);
        const extraBodyParams = thinkingParams || devStreamParams
          ? { ...(thinkingParams ?? {}), ...(devStreamParams ?? {}) }
          : undefined;

        if (runtime.config.devMode && message.devContext) {
          const trace = createAiTrace({
            requestId: message.requestId,
            context: message.devContext,
            runtime: runtime.config,
            thinkingMode,
            extraBodyParams,
            now: Date.now()
          });
          emitter = createAiPortTraceEmitter({
            trace,
            send,
            now: Date.now
          });
        }

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
            onFirstToken: () => {
              emitter?.onFirstToken();
              send({ type: "AI_STREAM_FIRST_TOKEN", requestId: message.requestId });
            },
            onDelta: (delta) =>
              send({ type: "AI_STREAM_CHUNK", requestId: message.requestId, delta }),
            onReasoningDelta: (delta) => {
              emitter?.onReasoningDelta(delta);
            },
            onUsage: (usage) => {
              emitter?.onUsage(usage);
            },
            onFinishReason: (reason) => {
              emitter?.onFinishReason(reason);
            },
            onDone: () => {
              const finalTrace = emitter?.onDone();
              send({ type: "AI_STREAM_DONE", requestId: message.requestId, ...(finalTrace ? { trace: finalTrace } : {}) });
            },
            onError: (errorMessage) => {
              const status = controller.signal.aborted ? "cancelled" : "error";
              const finalTrace = emitter?.onError(errorMessage, status);
              send({
                type: "AI_STREAM_ERROR",
                requestId: message.requestId,
                message: errorMessage,
                ...(finalTrace ? { trace: finalTrace } : {})
              });
            }
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unexpected streaming error.";
        const status = controller.signal.aborted ? "cancelled" : "error";
        const finalTrace = emitter?.onError(errorMessage, status);
        send({
          type: "AI_STREAM_ERROR",
          requestId: message.requestId,
          message: errorMessage,
          ...(finalTrace ? { trace: finalTrace } : {})
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
      const now = Date.now();
      getSettings().then(async (settings) => {
        const isDevModeActive = settings.devMode;
        let trace = isDevModeActive ? createToolTrace({ requestId: message.requestId, tool: "selection-action", now }) : undefined;

        if (sender.tab?.id) {
          try {
            if (trace) {
              trace = completeToolTrace(trace, Date.now(), {
                action: message.action,
                textLength: message.text.length
              });
            }
            await chrome.tabs.sendMessage(sender.tab.id, {
              type: "FORWARD_SELECTION_ACTION",
              requestId: message.requestId,
              prompt: message.prompt,
              title: message.title,
              actionPosition: { top: message.position?.top ?? 200, left: message.position?.left ?? 200 },
              ...(trace ? { toolTrace: trace } : {})
            });
            sendResponse({ ok: true, ...(trace ? { toolTrace: trace } : {}) });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (trace) {
              trace = failToolTrace(trace, Date.now(), errorMsg);
            }
            sendResponse({ ok: false, error: errorMsg, ...(trace ? { toolTrace: trace } : {}) });
          }
        } else {
          const errorMsg = "No sender tab available.";
          if (trace) {
            trace = failToolTrace(trace, Date.now(), errorMsg);
          }
          sendResponse({ ok: false, error: errorMsg, ...(trace ? { toolTrace: trace } : {}) });
        }
      });
      return true;
    }

    if (message.type === "EXTRACT_ACTIVE_PAGE") {
      const now = Date.now();
      getSettings().then(async (settings) => {
        const isDevModeActive = settings.devMode;
        let trace = isDevModeActive ? createToolTrace({ requestId: message.requestId, tool: "read-page", now }) : undefined;

        try {
          const tab = await getActiveTab();
          await injectContentAgent(tab.id!);
          let lastError: unknown;
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              const response = await chrome.tabs.sendMessage(tab.id!, { type: "EXTRACT_PAGE_CONTENT" });
              if (response && !response.error) {
                if (trace) {
                  trace = completeToolTrace(trace, Date.now(), {
                    extractor: response.method || "readability",
                    contentChars: typeof response.text === "string" ? response.text.length : 0,
                    warnings: response.warnings ? response.warnings.length : 0,
                    truncated: response.text ? response.text.length >= 40000 : false
                  });
                }
                sendResponse({ ...response, ...(trace ? { toolTrace: trace } : {}) });
                return;
              }
              lastError = response?.error || "Unknown extraction error";
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (err) {
              lastError = err;
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
          const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
          if (trace) {
            trace = failToolTrace(trace, Date.now(), errorMsg);
          }
          sendResponse({ error: errorMsg, ...(trace ? { toolTrace: trace } : {}) });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Page extraction failed.";
          if (trace) {
            trace = failToolTrace(trace, Date.now(), errorMsg);
          }
          sendResponse({ error: errorMsg, ...(trace ? { toolTrace: trace } : {}) });
        }
      });
      return true;
    }

    if (message.type === "OPEN_READING_COMPANION") {
      const now = Date.now();
      getSettings().then(async (settings) => {
        const isDevModeActive = settings.devMode;
        let trace = isDevModeActive ? createToolTrace({ requestId: message.requestId, tool: "open-reader", now }) : undefined;
        let readerReady: ((msg: any) => void) | undefined;
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

        const cleanupHandoff = () => {
          if (readerReady) {
            chrome.runtime.onMessage.removeListener(readerReady);
          }
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
        };

        try {
          const tab = await getActiveTab();
          await injectContentAgent(tab.id!);
          let lastError: unknown;
          let extractionSuccess = false;
          let response: any;

          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              response = await chrome.tabs.sendMessage(tab.id!, { type: "EXTRACT_PAGE_CONTENT" });
              if (response && !response.error) {
                extractionSuccess = true;
                break;
              }
              lastError = response?.error || "Unknown extraction error";
              await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (err) {
              lastError = err;
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }

          if (!extractionSuccess) {
            const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
            if (trace) {
              trace = failToolTrace(trace, Date.now(), errorMsg);
            }
            sendResponse({ error: errorMsg, ...(trace ? { toolTrace: trace } : {}) });
            return;
          }

          const readerTab = await chrome.tabs.create({ url: chrome.runtime.getURL(`/reader.html?requestId=${message.requestId}`) });
          
          if (trace) {
            trace = completeToolTrace(trace, Date.now(), {
              extractor: response.method || "readability",
              contentChars: response.text ? response.text.length : 0,
              warnings: response.warnings ? response.warnings.length : 0
            });
          }

          // Set handoff timeout
          timeoutHandle = setTimeout(() => {
            cleanupHandoff();
            if (trace) {
              trace = failToolTrace(trace, Date.now(), "Reader handoff timeout.");
            }
            if (readerTab.id !== undefined) {
              chrome.tabs.sendMessage(readerTab.id, {
                type: "LOAD_READER_ERROR",
                requestId: message.requestId,
                error: "Handoff timeout. Reader tab did not respond in time.",
                ...(trace ? { toolTrace: trace } : {})
              }).catch(() => undefined);
            }
          }, READER_HANDOFF_TIMEOUT_MS);

          readerReady = (msg: any) => {
            if (msg.type === "READER_CONTENT_READY" && msg.requestId === message.requestId) {
              cleanupHandoff();
              if (readerTab.id !== undefined) {
                chrome.tabs.sendMessage(readerTab.id, {
                  type: "LOAD_READER_CONTENT",
                  requestId: message.requestId,
                  title: response.title || tab.title || "",
                  url: response.url || tab.url || "",
                  content: response.text || response.content || "",
                  excerpt: response.excerpt || "",
                  ...(trace ? { toolTrace: trace } : {})
                }).catch(() => undefined);
              }
            }
          };

          chrome.runtime.onMessage.addListener(readerReady);
          sendResponse({ ok: true });
        } catch (error) {
          cleanupHandoff();
          const errorMsg = error instanceof Error ? error.message : "Open reader failed.";
          if (trace) {
            trace = failToolTrace(trace, Date.now(), errorMsg);
          }
          sendResponse({ error: errorMsg, ...(trace ? { toolTrace: trace } : {}) });
        }
      });
      return true;
    }

    if (message.type === "READER_SAVE_SESSION") {
      import("../src/core/storage/index").then(({ getSavedResults, saveSavedResults }) => {
        getSavedResults().then((results) => {
          const newResult = {
            id: crypto.randomUUID(),
            title: message.title || "Reading Session",
            sourceType: "page",
            sourceUrl: message.url || "",
            sourceTitle: message.title || "",
            outputMarkdown: message.summary || "",
            createdAt: message.date || new Date().toISOString(),
          } satisfies import("../src/core/storage/types").SavedResult;
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
