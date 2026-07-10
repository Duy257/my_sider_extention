import { useEffect, useMemo, useRef, useState } from "react";
import { getProvider } from "../../src/lib/ai/providers";
import { buildPagePrompt } from "../../src/lib/prompts/builders";
import { getPromptTemplates, getSavedResults, getSettings, savePromptTemplates, saveSavedResults, saveSettings } from "../../src/lib/storage";
import type { PromptTemplate } from "../../src/lib/prompts/types";
import type { SavedResult, Settings } from "../../src/lib/storage/types";
import { ChatComposer } from "./components/ChatComposer";
import { ChatMessage, TypingIndicator } from "./components/ChatMessage";
import { HeaderBar, type HeaderView } from "./components/HeaderBar";
import { PromptManager } from "./components/PromptManager";
import { SavedResults } from "./components/SavedResults";
import { SettingsPanel } from "./components/SettingsPanel";
import { SkeletonPanel } from "./components/Skeleton";
import { EmptyState } from "./components/EmptyState";
import { useChatController, type ChatItem } from "./hooks/useChatController";

export default function App() {
  const [view, setView] = useState<HeaderView>("chat");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [savedResults, setSavedResultsState] = useState<SavedResult[]>([]);
  const [readingPage, setReadingPage] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  const chat = useChatController({ canSend: Boolean(settings && provider && !missingApiKey && !missingModel) });

  useEffect(() => {
    Promise.all([getSettings(), getPromptTemplates(), getSavedResults()]).then(([loadedSettings, loadedPrompts, loadedSaved]) => {
      setSettings(loadedSettings);
      setPrompts(loadedPrompts);
      setSavedResultsState(loadedSaved);
    });
    chrome.runtime.sendMessage({ type: "ACTIVATE_ACTIVE_TAB_AGENT", requestId: crypto.randomUUID() }).catch(() => undefined);
  }, []);

  const sendPromptRef = useRef(chat.sendPrompt);

  async function updateSettings(next: Settings) {
    setSettings(next);
    await saveSettings(next);
    chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" }).catch(() => undefined);
  }

  async function updatePrompts(next: PromptTemplate[]) {
    setPrompts(next);
    await savePromptTemplates(next);
  }

  sendPromptRef.current = chat.sendPrompt;

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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chat.messages, chat.streamingPhase]);

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
      saveSavedResults(updated);
      return updated;
    });
  }

  async function readPage() {
    chat.setError("");
    setReadingPage(true);
    setView("chat");
    try {
      const response = await chrome.runtime.sendMessage({
        type: "EXTRACT_ACTIVE_PAGE",
        requestId: crypto.randomUUID()
      });

      if (response?.error) {
        chat.setError(response.error);
        return;
      }

      if (!response?.text) {
        chat.setError("Trang này không có nội dung đọc được.");
        return;
      }

      chat.sendPrompt(
        buildPagePrompt({
          title: response.title,
          url: response.url,
          text: response.text,
          warnings: response.warnings || []
        })
      );
    } catch {
      chat.setError("Không thể đọc trang.");
    } finally {
      setReadingPage(false);
    }
  }

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
      
      {chat.error ? (
        <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-red-900/30 bg-red-950/20 px-3.5 py-2.5 text-xs text-red-400 animate-fade-in-up">
          <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="flex-1 font-medium">{chat.error}</span>
          <button 
            onClick={chat.dismissError} 
            className="text-stone-400 hover:text-stone-200 transition-colors text-sm font-bold px-1"
          >
            ×
          </button>
        </div>
      ) : null}

      {view === "settings" ? <SettingsPanel settings={settings} onChange={updateSettings} /> : null}
      {view === "prompts" ? <PromptManager prompts={prompts} onChange={updatePrompts} /> : null}
      {view === "saved" ? <SavedResults results={savedResults} onDelete={(id) => {
        setSavedResultsState((prev) => {
          const updated = prev.filter((item) => item.id !== id);
          saveSavedResults(updated);
          return updated;
        });
      }} /> : null}
      
      {view === "chat" ? (
        <>
          {chat.messages.length > 0 || chat.streaming ? (
            <div className="flex justify-end px-3.5 pt-3">
              <button
                type="button"
                title="Chat mới"
                onClick={chat.clearChat}
                className="rounded-lg border border-stone-800/60 bg-surface/60 px-3 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:border-primary/30 hover:text-stone-100"
              >
                Chat mới
              </button>
            </div>
          ) : null}
          <section className="flex-1 space-y-3.5 overflow-auto p-3.5" aria-live="polite" aria-relevant="additions">
            {chat.messages.length === 0 ? (
              <EmptyState onChipClick={(text) => chat.sendPrompt(text)} />
            ) : (
              chat.messages.map((item) => (
                <ChatMessage 
                  key={item.id} 
                  role={item.role} 
                  content={item.content} 
                  onSave={item.role === "assistant" ? () => saveMessage(item) : undefined}
                  onActionError={chat.setError}
                />
              ))
            )}
            {chat.streaming && chat.messages.length > 0 && chat.messages[chat.messages.length - 1].content === "" ? (
              <TypingIndicator phase={chat.streamingPhase} />
            ) : null}
            {chat.streaming && chat.streamingPhase === "connecting" && (
              <div className="flex justify-center">
                <button
                  onClick={chat.cancelStream}
                  className="text-xs text-stone-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg border border-stone-800/50 hover:border-red-900/30 hover:bg-red-950/10"
                >
                  Hủy yêu cầu
                </button>
              </div>
            )}
            <div ref={chatEndRef} />
          </section>
          
          <ChatComposer
            disabled={chat.streaming || missingApiKey || missingModel}
            onSend={(text, thinkingMode) => chat.sendPrompt(text, thinkingMode)}
            showMissingKeyBanner={missingApiKey || missingModel}
            missingType={missingApiKey ? "key" : "model"}
            providerLabel={provider?.label}
            sending={chat.streaming}
            defaultThinkingMode={settings?.thinkingMode}
          />
        </>
      ) : null}
    </main>
  );
}
