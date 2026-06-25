import { useEffect, useMemo, useRef, useState } from "react";
import { getProvider } from "../../src/lib/ai/providers";
import { buildUserChatMessages } from "../../src/lib/prompts/builders";
import { getPromptTemplates, getSavedResults, getSettings, savePromptTemplates, saveSavedResults, saveSettings } from "../../src/lib/storage";
import type { PromptTemplate } from "../../src/lib/prompts/types";
import type { SavedResult, Settings } from "../../src/lib/storage/types";
import { AI_STREAM_PORT } from "../../src/lib/messaging/ports";
import type { AiPortResponse } from "../../src/lib/messaging/types";
import { ChatComposer } from "./components/ChatComposer";
import { ChatMessage, TypingIndicator } from "./components/ChatMessage";
import { HeaderBar, type HeaderView } from "./components/HeaderBar";
import { PromptManager } from "./components/PromptManager";
import { SavedResults } from "./components/SavedResults";
import { SettingsPanel } from "./components/SettingsPanel";
import { SkeletonPanel } from "./components/Skeleton";
import { EmptyState } from "./components/EmptyState";

type ChatItem = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export default function App() {
  const [view, setView] = useState<HeaderView>("chat");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [savedResults, setSavedResultsState] = useState<SavedResult[]>([]);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  
  // Auto-dismissing error state implementation
  const [error, setErrorState] = useState("");
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setError = (msg: string) => {
    setErrorState(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (msg) {
      errorTimerRef.current = setTimeout(() => {
        setErrorState("");
      }, 8000);
    }
  };

  const [readingPage, setReadingPage] = useState(false);

  const provider = settings ? getProvider(settings.providerId) : undefined;
  const selectedModel = settings && provider ? settings.selectedModels[provider.id]?.trim() || provider.defaultModel?.trim() : "";
  
  const missingApiKey = useMemo(() => {
    if (!settings || !provider) return true;
    if (!provider.requiresApiKey) return false;
    return !settings.apiKeys[provider.id]?.trim();
  }, [settings, provider]);
  
  const missingModel = useMemo(() => {
    if (!settings || !provider) return true;
    return !selectedModel;
  }, [settings, provider, selectedModel]);

  useEffect(() => {
    Promise.all([getSettings(), getPromptTemplates(), getSavedResults()]).then(([loadedSettings, loadedPrompts, loadedSaved]) => {
      setSettings(loadedSettings);
      setPrompts(loadedPrompts);
      setSavedResultsState(loadedSaved);
    });
    chrome.runtime.sendMessage({ type: "ACTIVATE_ACTIVE_TAB_AGENT", requestId: crypto.randomUUID() }).catch(() => undefined);
    
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const sendPromptRef = useRef(sendPrompt);
  async function updateSettings(next: Settings) {
    setSettings(next);
    await saveSettings(next);
  }

  async function updatePrompts(next: PromptTemplate[]) {
    setPrompts(next);
    await savePromptTemplates(next);
  }

  async function updateSavedResults(next: SavedResult[]) {
    setSavedResultsState(next);
    await saveSavedResults(next);
  }

  function sendPrompt(text: string) {
    if (!settings) return;
    if (streaming) return;
    setError("");
    setStreaming(true);

    const requestId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" }
    ]);

    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: AI_STREAM_PORT });
    } catch {
      setStreaming(false);
      setError("Không thể kết nối dịch vụ AI.");
      return;
    }

    port.onDisconnect.addListener(() => {
      setStreaming(false);
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message || "Mất kết nối.");
      }
    });

    port.onMessage.addListener((message: AiPortResponse) => {
      if (message.requestId !== requestId) return;

      if (message.type === "AI_STREAM_CHUNK") {
        setMessages((current) =>
          current.map((item) => (item.id === assistantId ? { ...item, content: item.content + message.delta } : item))
        );
      }

      if (message.type === "AI_STREAM_DONE") {
        setStreaming(false);
        port.disconnect();
      }

      if (message.type === "AI_STREAM_ERROR") {
        setStreaming(false);
        setError(message.message);
        port.disconnect();
      }
    });

    port.postMessage({
      type: "AI_CHAT_REQUEST",
      requestId,
      messages: buildUserChatMessages(text)
    });
  }

  sendPromptRef.current = sendPrompt;

  useEffect(() => {
    function handleMessage(msg: { type: string; prompt?: string }) {
      if (msg.type === "FORWARD_SELECTION_ACTION" && msg.prompt) {
        setView("chat");
        sendPromptRef.current(msg.prompt);
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  async function saveMessage(item: ChatItem) {
    const newResult: SavedResult = {
      id: crypto.randomUUID(),
      title: item.content.slice(0, 60) || "Phản hồi đã lưu",
      sourceType: "chat" as const,
      outputMarkdown: item.content,
      createdAt: new Date().toISOString()
    };
    setSavedResultsState((prev) => {
      const updated = [newResult, ...prev];
      saveSavedResults(updated).catch(() => undefined);
      return updated;
    });
  }

  async function readPage() {
    setError("");
    setReadingPage(true);
    setView("chat");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "EXTRACT_ACTIVE_PAGE",
        requestId: crypto.randomUUID()
      });

      if (response?.error) {
        setError(response.error);
        return;
      }

      if (!response?.text) {
        setError("Trang này không có nội dung đọc được.");
        return;
      }

      sendPrompt(
        [
          "Đọc trang này và tóm tắt từ góc nhìn CEO.",
          "",
          `Tiêu đề: ${response.title}`,
          `URL: ${response.url}`,
          response.warnings?.length ? `Cảnh báo: ${response.warnings.join(" ")}` : "",
          "",
          response.text
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch {
      setError("Không thể đọc trang.");
    } finally {
      setReadingPage(false);
    }
  }

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "GET_PENDING_SELECTION_PROMPT", requestId: crypto.randomUUID() })
      .then((pending) => {
        if (pending?.prompt) {
          setView("chat");
          sendPrompt(pending.prompt);
        }
      })
      .catch(() => undefined);
  }, [settings?.providerId, selectedModel]);

  if (!settings) {
    return (
      <main className="flex min-h-screen flex-col bg-warm-bg text-stone-50">
        <SkeletonPanel />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-warm-bg text-stone-50">
      <HeaderBar view={view} onViewChange={setView} onReadPage={readPage} readingPage={readingPage} />
      
      {error ? (
        <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-red-900/30 bg-red-950/20 px-3.5 py-2.5 text-xs text-red-400 animate-fade-in-up">
          <svg className="h-4.5 w-4.5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="flex-1 font-medium">{error}</span>
          <button 
            onClick={() => setError("")} 
            className="text-stone-400 hover:text-stone-200 transition-colors text-sm font-bold px-1"
          >
            ×
          </button>
        </div>
      ) : null}

      {view === "settings" ? <SettingsPanel settings={settings} onChange={updateSettings} /> : null}
      {view === "prompts" ? <PromptManager prompts={prompts} onChange={updatePrompts} /> : null}
      {view === "saved" ? <SavedResults results={savedResults} onDelete={(id) => updateSavedResults(savedResults.filter((item) => item.id !== id))} /> : null}
      
      {view === "chat" ? (
        <>
          <section className="flex-1 space-y-3.5 overflow-auto p-3.5" aria-live="polite" aria-relevant="additions">
            {messages.length === 0 ? (
              <EmptyState onChipClick={(text) => sendPrompt(text)} />
            ) : (
              messages.map((item) => (
                <ChatMessage 
                  key={item.id} 
                  role={item.role} 
                  content={item.content} 
                  onSave={item.role === "assistant" ? () => saveMessage(item) : undefined} 
                />
              ))
            )}
            {streaming && messages.length > 0 && messages[messages.length - 1].content === "" ? (
              <TypingIndicator />
            ) : null}
          </section>
          
          <ChatComposer
            disabled={streaming || missingApiKey || missingModel}
            onSend={sendPrompt}
            showMissingKeyBanner={missingApiKey || missingModel}
            missingType={missingApiKey ? "key" : "model"}
            providerLabel={provider?.label}
            sending={streaming}
          />
        </>
      ) : null}
    </main>
  );
}
