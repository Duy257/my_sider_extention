import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getProvider } from "../../src/core/ai/providers";
import { getPromptTemplates, getSavedResults, getSettings, savePromptTemplates, saveSavedResults, saveSettings } from "../../src/core/storage";
import type { PromptTemplate } from "../../src/core/prompts/types";
import type { SavedResult, Settings } from "../../src/core/storage/types";
import { ChatComposer } from "./components/ChatComposer";
import { ChatMessage } from "./components/ChatMessage";
import { HeaderBar, type HeaderView } from "./components/HeaderBar";
import { PromptManager } from "./components/PromptManager";
import { SavedResults } from "./components/SavedResults";
import { SettingsPanel } from "./components/SettingsPanel";
import { SkeletonPanel } from "./components/Skeleton";
import { EmptyState } from "./components/EmptyState";
import { useChatController } from "./hooks/useChatController";
import { useStickToBottom } from "./hooks/useStickToBottom";
import { ToolTraceCard } from "../../src/components/devtools/ToolTraceCard";

export default function App() {
  const [view, setView] = useState<HeaderView>("chat");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [savedResults, setSavedResultsState] = useState<SavedResult[]>([]);
  const [storageError, setStorageError] = useState("");
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
  const stickToBottomRef = useStickToBottom();

  useEffect(() => {
    Promise.all([getSettings(), getPromptTemplates(), getSavedResults()]).then(([loadedSettings, loadedPrompts, loadedSaved]) => {
      setSettings(loadedSettings);
      setPrompts(loadedPrompts);
      setSavedResultsState(loadedSaved);
    });
    chrome.runtime.sendMessage({ type: "ACTIVATE_ACTIVE_TAB_AGENT", requestId: crypto.randomUUID() }).catch(() => undefined);
  }, []);

  // Gửi tin mới luôn kéo về đáy, kể cả khi người dùng đang cuộn lên đọc tin cũ
  function sendChatPrompt(text: string, thinkingMode?: Settings["thinkingMode"]) {
    stickToBottomRef.current = true;
    chat.sendPrompt(text, thinkingMode, settings?.devMode ? { surface: "sidepanel", feature: "chat" } : undefined);
  }

  const sendPromptRef = useRef(sendChatPrompt);

  async function updateSettings(next: Settings) {
    setSettings(next);
    const result = await saveSettings(next);
    if (!result.ok) {
      setStorageError(`Không thể lưu cài đặt: ${result.error}`);
    }
    chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" }).catch(() => undefined);
  }

  async function updatePrompts(next: PromptTemplate[]) {
    setPrompts(next);
    const result = await savePromptTemplates(next);
    if (!result.ok) {
      setStorageError(`Không thể lưu prompt: ${result.error}`);
    }
  }

  sendPromptRef.current = sendChatPrompt;

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

  // Chỉ bám đáy khi người dùng đang ở gần đáy, để có thể cuộn lên đọc tin cũ trong lúc stream
  useEffect(() => {
    if (stickToBottomRef.current) {
      chatEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [chat.messages, chat.streamingPhase, stickToBottomRef]);

  // Reference ổn định để ChatMessage (memo) không bị vẽ lại khi tin khác đang stream
  const saveMessage = useCallback(async (content: string) => {
    const newResult: SavedResult = {
      id: crypto.randomUUID(),
      title: content.slice(0, 60) || "Phản hồi đã lưu",
      sourceType: "chat" as const,
      outputMarkdown: content,
      createdAt: new Date().toISOString()
    };
    setSavedResultsState((prev) => {
      const updated = [newResult, ...prev];
      saveSavedResults(updated).then((result) => {
        if (!result.ok) {
          setStorageError(`Không thể lưu kết quả: ${result.error}`);
        }
      });
      return updated;
    });
  }, []);

  if (!settings) {
    return (
      <main className="flex min-h-screen flex-col bg-warm-bg text-stone-50">
        <SkeletonPanel />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-warm-bg text-stone-50">
      <HeaderBar 
        view={view} 
        onViewChange={setView} 
        onClearChat={chat.clearChat} 
        hasMessages={chat.messages.length > 0 || chat.streaming} 
      />
      
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

      {storageError ? (
        <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl border border-amber-900/30 bg-amber-950/20 px-3.5 py-2.5 text-xs text-amber-400 animate-fade-in-up">
          <span className="flex-1 font-medium">{storageError}</span>
          <button
            onClick={() => setStorageError("")}
            className="text-amber-400/70 hover:text-amber-300 transition-colors text-sm font-bold px-1"
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
          saveSavedResults(updated).then((result) => {
            if (!result.ok) {
              setStorageError(`Không thể cập nhật kết quả đã lưu: ${result.error}`);
            }
          });
          return updated;
        });
      }} /> : null}
      
      {view === "chat" ? (
        <>
          {/* aria-busy: trình đọc màn hình chờ stream xong mới đọc, thay vì đọc từng đoạn mới */}
          <section
            className="flex-1 space-y-3.5 overflow-auto p-3.5"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={chat.streaming}
          >
            {chat.messages.length === 0 ? (
              <EmptyState onChipClick={(text) => sendChatPrompt(text)} />
            ) : (
              chat.messages.map((item, index) => {
                if (item.kind === "tool-trace") {
                  return <ToolTraceCard key={item.id} trace={item.trace} />;
                }
                // Chỉ tin cuối, đang stream và chưa có nội dung mới hiện chỉ báo phase
                const pendingPhase =
                  chat.streaming &&
                  chat.streamingPhase !== "idle" &&
                  index === chat.messages.length - 1 &&
                  item.role === "assistant" &&
                  !item.content
                    ? chat.streamingPhase
                    : undefined;
                return (
                  <ChatMessage
                    key={item.id}
                    role={item.role}
                    content={item.content}
                    debug={item.debug}
                    pendingPhase={pendingPhase}
                    onSave={item.role === "assistant" ? saveMessage : undefined}
                    onActionError={chat.setError}
                  />
                );
              })
            )}
            <div ref={chatEndRef} />
          </section>

          <ChatComposer
            disabled={chat.streaming || missingApiKey || missingModel}
            onSend={sendChatPrompt}
            onStop={chat.cancelStream}
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
